import { create } from "zustand";
import { setupApi, ApiRequestError } from "@/lib/api";
import { mapSkill } from "@/lib/mappers";
import { DEFAULT_CONSTRAINT_THRESHOLDS, type ConstraintThresholds } from "@/lib/constraints";

/**
 * Skills and scheduling-rule thresholds are admin-editable data on the
 * backend now (`settings/ConstraintThresholds`, `skill/Skill`) rather than
 * hardcoded constants — this store just mirrors what's in the database,
 * refetched on login and updated in place after every mutation.
 */

export interface SkillDef {
  id: string; // the backend's skill `key` — what Shift.skillRequired / User.skills store
  label: string;
  color: string; // hex, used for the shift-card accent dot
}

/** Internal bookkeeping the UI never needs directly: the numeric database
 * id required to PUT/DELETE a skill (`/setup/skills/{id}`), since the rest
 * of the app addresses skills by their string `key` instead. */
type SkillWithBackendId = SkillDef & { backendId: number };

export interface SettingsMutationResult {
  success: boolean;
  reason?: string;
  unauthorized?: boolean;
}

const FALLBACK_SKILL_COLOR = "#6B7280";

function reasonFor(err: unknown, fallback: string): SettingsMutationResult {
  if (err instanceof ApiRequestError) {
    return { success: false, unauthorized: err.status === 403, reason: err.message };
  }
  return { success: false, reason: fallback };
}

interface SettingsState {
  skills: SkillDef[];
  constraintThresholds: ConstraintThresholds;
  loaded: boolean;

  skillById: (id: string) => SkillDef | undefined;
  skillColor: (id: string) => string;
  skillLabel: (id: string) => string;
  /** The numeric database id behind a skill's string `key` — needed
   * whenever a mutation (creating/editing a shift or a user) has to send
   * `skillId` to the backend instead of the `key` the rest of the app uses. */
  skillNumericId: (key: string) => number | undefined;

  load: () => Promise<void>;

  addSkill: (input: { label: string; color: string }) => Promise<SettingsMutationResult>;
  updateSkill: (id: string, patch: Partial<Pick<SkillDef, "label" | "color">>) => Promise<SettingsMutationResult>;
  removeSkill: (id: string) => Promise<SettingsMutationResult>;

  updateConstraintThresholds: (patch: Partial<ConstraintThresholds>) => Promise<SettingsMutationResult>;
}

/** Not exported — internal list keeps the numeric backend id alongside
 * each SkillDef so mutations can address `/setup/skills/{id}`. */
let skillsWithBackendId: SkillWithBackendId[] = [];

export const useSettingsStore = create<SettingsState>((set, get) => ({
  skills: [],
  constraintThresholds: DEFAULT_CONSTRAINT_THRESHOLDS,
  loaded: false,

  skillById: (id) => get().skills.find((s) => s.id === id),
  skillColor: (id) => get().skills.find((s) => s.id === id)?.color ?? FALLBACK_SKILL_COLOR,
  skillLabel: (id) => get().skills.find((s) => s.id === id)?.label ?? id.replace(/_/g, " "),
  skillNumericId: (key) => skillsWithBackendId.find((s) => s.id === key)?.backendId,

  load: async () => {
    const [skillDtos, thresholdsDto] = await Promise.all([setupApi.listSkills(), setupApi.getThresholds()]);
    skillsWithBackendId = skillDtos.map(mapSkill);
    set({
      skills: skillsWithBackendId.map(({ id, label, color }) => ({ id, label, color })),
      constraintThresholds: {
        minRestHours: thresholdsDto.minRestHours,
        dailyHardBlockHours: thresholdsDto.dailyHardBlockHours,
        dailyWarningHours: thresholdsDto.dailyWarningHours,
        weeklyWarningHours: thresholdsDto.weeklyWarningHours,
        weeklyFullTimeHours: thresholdsDto.weeklyFullTimeHours,
      },
      loaded: true,
    });
  },

  addSkill: async (input) => {
    const label = input.label.trim();
    if (!label) return { success: false, reason: "Give the skill a name." };
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!key) return { success: false, reason: "That name doesn't produce a usable skill id — try letters or numbers." };
    try {
      const dto = await setupApi.createSkill({ key, label, colorHex: input.color || FALLBACK_SKILL_COLOR });
      const mapped = mapSkill(dto);
      skillsWithBackendId = [...skillsWithBackendId, mapped];
      set({ skills: skillsWithBackendId.map(({ id, label, color }) => ({ id, label, color })) });
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't add that skill.");
    }
  },

  updateSkill: async (id, patch) => {
    const existing = skillsWithBackendId.find((s) => s.id === id);
    if (!existing) return { success: false, reason: "That skill no longer exists." };
    try {
      const dto = await setupApi.updateSkill(existing.backendId, {
        key: existing.id,
        label: patch.label?.trim() || existing.label,
        colorHex: patch.color ?? existing.color,
      });
      const mapped = mapSkill(dto);
      skillsWithBackendId = skillsWithBackendId.map((s) => (s.id === id ? mapped : s));
      set({ skills: skillsWithBackendId.map(({ id, label, color }) => ({ id, label, color })) });
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't save that skill.");
    }
  },

  removeSkill: async (id) => {
    const existing = skillsWithBackendId.find((s) => s.id === id);
    if (!existing) return { success: false, reason: "That skill no longer exists." };
    try {
      await setupApi.deleteSkill(existing.backendId);
      skillsWithBackendId = skillsWithBackendId.filter((s) => s.id !== id);
      set({ skills: skillsWithBackendId.map(({ id, label, color }) => ({ id, label, color })) });
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't remove that skill — it may still be used by staff or a shift.");
    }
  },

  updateConstraintThresholds: async (patch) => {
    const before = get().constraintThresholds;
    const next: ConstraintThresholds = { ...before, ...patch };
    if (Object.values(next).some((v) => !Number.isFinite(v) || v < 0)) {
      return { success: false, reason: "All thresholds must be positive numbers." };
    }
    if (next.dailyWarningHours > next.dailyHardBlockHours) {
      return { success: false, reason: "The daily warning threshold can't be higher than the daily hard limit." };
    }
    if (next.weeklyWarningHours > next.weeklyFullTimeHours) {
      return { success: false, reason: "The weekly warning threshold can't be higher than the full-time threshold." };
    }
    try {
      const dto = await setupApi.updateThresholds(patch);
      set({
        constraintThresholds: {
          minRestHours: dto.minRestHours,
          dailyHardBlockHours: dto.dailyHardBlockHours,
          dailyWarningHours: dto.dailyWarningHours,
          weeklyWarningHours: dto.weeklyWarningHours,
          weeklyFullTimeHours: dto.weeklyFullTimeHours,
        },
      });
      return { success: true };
    } catch (err) {
      return reasonFor(err, "Couldn't save those rules.");
    }
  },
}));
