/** Carrier equipment types (shared by forms and the dashboard; kept free of validation code). */
export const equipmentOptions = [
  { value: "dry_van", label: "Dry van" },
  { value: "reefer", label: "Refrigerated (reefer)" },
  { value: "flatbed", label: "Flatbed" },
  { value: "step_deck", label: "Step deck" },
  { value: "box_truck", label: "Box truck" },
  { value: "sprinter", label: "Cargo van / Sprinter" },
  { value: "power_only", label: "Power only" },
  { value: "other", label: "Other" },
] as const;
