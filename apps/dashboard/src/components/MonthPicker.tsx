"use client";

import { useId, useState } from "react";
import FinanceIcon from "./FinanceIcon";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const panelId = useId();
  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));

  return (
    <div
      className="month-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.currentTarget
            .querySelector<HTMLButtonElement>(".month-control")
            ?.focus();
        }
      }}
    >
      <button
        type="button"
        className="month-control"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) setYear(selectedYear);
          setOpen(!open);
        }}
      >
        <FinanceIcon name="calendar" />
        <span>
          {MONTHS[selectedMonth - 1]} {selectedYear}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          id={panelId}
          className="month-picker-panel"
          role="group"
          aria-label="Choose month"
        >
          <div className="month-picker-year">
            <button
              type="button"
              aria-label="Previous year"
              disabled={year <= 1}
              onClick={() => setYear(year - 1)}
            >
              ‹
            </button>
            <strong aria-live="polite">{year}</strong>
            <button
              type="button"
              aria-label="Next year"
              disabled={year >= 9999}
              onClick={() => setYear(year + 1)}
            >
              ›
            </button>
          </div>
          <div className="month-picker-grid">
            {MONTHS.map((name, index) => (
              <button
                key={name}
                type="button"
                aria-label={`${name} ${year}`}
                aria-pressed={
                  selectedYear === year && selectedMonth === index + 1
                }
                onClick={(event) => {
                  onChange(
                    `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`,
                  );
                  setOpen(false);
                  event.currentTarget
                    .closest(".month-picker")
                    ?.querySelector<HTMLButtonElement>(".month-control")
                    ?.focus();
                }}
              >
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
