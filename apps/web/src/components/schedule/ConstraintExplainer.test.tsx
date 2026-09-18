import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConstraintExplainer } from "@/components/schedule/ConstraintExplainer";
import type { AssignmentCheck } from "@/types";

describe("ConstraintExplainer", () => {
  it("shows a clear success message when there are no violations", () => {
    const check: AssignmentCheck = { ok: true, violations: [], suggestions: [] };
    render(<ConstraintExplainer check={check} />);
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
  });

  it("renders every violation's plain-language message and severity styling", () => {
    const check: AssignmentCheck = {
      ok: false,
      violations: [
        { code: "SKILL_MISMATCH", severity: "block", message: "Sarah isn't certified as a bartender." },
        { code: "DAILY_HOURS_BLOCK", severity: "warning", message: "This puts Sarah at 9.0 hours in one day." },
      ],
      suggestions: [],
    };
    render(<ConstraintExplainer check={check} />);
    expect(screen.getByText("Sarah isn't certified as a bartender.")).toBeInTheDocument();
    expect(screen.getByText("This puts Sarah at 9.0 hours in one day.")).toBeInTheDocument();
  });

  it("lets the user pick a suggested alternative", () => {
    const onPick = vi.fn();
    const check: AssignmentCheck = {
      ok: false,
      violations: [{ code: "SKILL_MISMATCH", severity: "block", message: "Not qualified." }],
      suggestions: [{ userId: "u-2", reason: "Has the required skill and is free at this time." }],
    };
    render(<ConstraintExplainer check={check} onPickSuggestion={onPick} />);
    fireEvent.click(screen.getByText(/has the required skill/i));
    expect(onPick).toHaveBeenCalledWith("u-2");
  });
});
