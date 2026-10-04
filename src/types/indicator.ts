export const CRITICITIES = [
  { code: "GOOD", order: 0, color: "#16a34a" },
  { code: "INFO", order: 1, color: "#009dcf" },
  { code: "WARNING", order: 2, color: "#ca8a04" },
  { code: "DANGER", order: 3, color: "#dc2626" },
  { code: "OK", order: 4, color: "#16a34a" },
] as const;

export type Criticity = (typeof CRITICITIES)[number]["code"];

export interface Indicator {
  icon: string;
  criticity: Criticity;
  code: string;
  description?: string;
}

export function getCriticity(code: Criticity) {
  return CRITICITIES.find((criticity) => criticity.code === code)!;
}

export function getIndicatorColor(indicator: Indicator): string {
  return getCriticity(indicator.criticity).color;
}

export const INDICATORS = [
  {
    icon: "✅",
    criticity: "OK",
    code: "WANTED",
    description: "Société souhaitée",
  },
  {
    icon: "💵",
    criticity: "GOOD",
    code: "SALARY_AND_ADVANTAGES",
    description: "Affiche salaire et avantages",
  },
  {
    icon: "💼",
    criticity: "INFO",
    code: "IT_SERVICES_COMPANY",
    description: "ESN / SSI",
  },
  {
    icon: "👨‍💼",
    criticity: "INFO",
    code: "HEADHUNTER",
    description: "recruteur / société de placement",
  },
  {
    icon: "💸",
    criticity: "WARNING",
    code: "WITHOUT_SALARY_NOR_ADVANTAGES",
  },
  {
    icon: "⚠️",
    criticity: "WARNING",
    code: "SUSPECT",
  },
  {
    icon: "❌",
    criticity: "DANGER",
    code: "BANNED",
    description: "Société à éviter",
  },
  {
    icon: "🚫",
    criticity: "DANGER",
    code: "DONT_ANSWER",
    description: "Ne répond pas",
  },
  {
    icon: "⚠️",
    criticity: "WARNING",
    code: "FREELANCE",
    description: "Freelance",
  },
] as const satisfies readonly Indicator[];

export type IndicatorCode = (typeof INDICATORS)[number]["code"];

function compareByCriticity(a: Indicator, b: Indicator): number {
  return getCriticity(a.criticity).order - getCriticity(b.criticity).order;
}

export function getIndicators(): Indicator[] {
  return [...INDICATORS].sort(compareByCriticity);
}

export function getIndicatorByCode(code: string): Indicator | undefined {
  return INDICATORS.find((indicator) => indicator.code === code);
}

export function sortIndicatorsByCriticityDesc(codes: readonly string[]): Indicator[] {
  return codes
    .map((code) => getIndicatorByCode(code))
    .filter((indicator): indicator is Indicator => indicator !== undefined)
    .sort((a, b) => compareByCriticity(b, a));
}

export function getIndicatorsColor(codes: readonly string[]): string | undefined {
  const [top] = sortIndicatorsByCriticityDesc(codes);
  return top ? getIndicatorColor(top) : undefined;
}

export function formatIndicatorLabel(indicator: Indicator): string {
  return indicator.description
    ? `${indicator.code} — ${indicator.description}`
    : indicator.code;
}

export function stripLeadingIndicatorIcon(text: string): string {
  const icons = INDICATORS.map((indicator) => indicator.icon).sort(
    (left, right) => right.length - left.length
  );
  const value = text.trimStart();
  const icon = icons.find((candidate) => value.startsWith(candidate));
  return icon ? value.slice(icon.length).trimStart() : text;
}
