export const CRITICITIES = [
  { "code": "GOOD", "order": 0, "color": "#16a34a" },
  { "code": "INFO", "order": 1, "color": "#009dcf" },
  { "code": "WARNING", "order": 2, "color": "#ca8a04" },
  { "code": "DANGER", "order": 3, "color": "#dc2626" },
  { "code": "OK", "order": 4, "color": "#16a34a" }
] as const;

export type Criticity = (typeof CRITICITIES)[number]["code"];

export interface Indicator {
  "icon": string;
  "criticity": Criticity;
  "code": string;
  "description"?: string;
}

function getCriticity (code: Criticity): { "code": Criticity; "order": number; "color": string } {
  const found = CRITICITIES.find((criticity) => {
    return criticity.code === code;
  });
  if (found === undefined) {
    throw new Error(`Unknown criticity: ${code}`);
  }
  return found;
}

export function getIndicatorColor (indicator: Indicator): string {
  return getCriticity(indicator.criticity).color;
}

export const INDICATORS = [
  {
    "icon": "✅",
    "criticity": "OK",
    "code": "WANTED",
    "description": "Desired company"
  },
  {
    "icon": "💵",
    "criticity": "GOOD",
    "code": "SALARY_AND_ADVANTAGES",
    "description": "Shows salary and benefits"
  },
  {
    "icon": "💼",
    "criticity": "INFO",
    "code": "IT_SERVICES_COMPANY",
    "description": "IT services company"
  },
  {
    "icon": "👨‍💼",
    "criticity": "INFO",
    "code": "HEADHUNTER",
    "description": "Recruiter / staffing agency"
  },
  {
    "icon": "💸",
    "criticity": "WARNING",
    "code": "WITHOUT_SALARY_NOR_ADVANTAGES",
    "description": "Does not show salary or benefits"
  },
  {
    "icon": "⚠️",
    "criticity": "WARNING",
    "code": "SUSPECT",
    "description": "Suspicious"
  },
  {
    "icon": "❌",
    "criticity": "DANGER",
    "code": "BANNED",
    "description": "Company to avoid"
  },
  {
    "icon": "🚫",
    "criticity": "DANGER",
    "code": "DONT_ANSWER",
    "description": "Does not reply"
  },
  {
    "icon": "⚠️",
    "criticity": "WARNING",
    "code": "FREELANCE",
    "description": "Freelance"
  }
] as const satisfies readonly Indicator[];

export type IndicatorCode = (typeof INDICATORS)[number]["code"];

function compareByCriticity (a: Indicator, b: Indicator): number {
  return getCriticity(a.criticity).order - getCriticity(b.criticity).order;
}

export function getIndicators (): Indicator[] {
  return [ ...INDICATORS ].sort(compareByCriticity);
}

export function getIndicatorByCode (code: string): Indicator | undefined {
  return INDICATORS.find((indicator) => {
 return indicator.code === code;
});
}

export function sortIndicatorsByCriticityDesc (codes: readonly string[]): Indicator[] {

  return codes
    .map((code) => {
 return getIndicatorByCode(code);
})
    .filter((indicator): indicator is Indicator => {
 return indicator !== undefined;
})
    .sort((a, b) => {
 return compareByCriticity(b, a);
});

}

export function getIndicatorsColor (codes: readonly string[]): string | undefined {
  const [ top ] = sortIndicatorsByCriticityDesc(codes);
  // Le tableau peut être vide : `top` est alors indéfini malgré le typage.
  const first = top as Indicator | undefined;
  return first === undefined ? undefined : getIndicatorColor(first);
}

export function formatIndicatorLabel (indicator: Indicator): string {

  return undefined !== indicator.description && "" !== indicator.description
    ? `${indicator.code} — ${indicator.description}`
    : indicator.code;

}

export function stripLeadingIndicatorIcon (text: string): string {

  const icons = INDICATORS.map((indicator) => {
 return indicator.icon;
}).sort(
    (left, right) => {
 return right.length - left.length;
}
  );

  let value = text.trimStart();
  let stripped = false;

  for (;;) {

    const current = value;
    const icon = icons.find((candidate) => {
      return current.startsWith(candidate);
    });

    if (icon === undefined) {
      break;
    }

    value = current.slice(icon.length).trimStart();
    stripped = true;

  }

  return stripped ? value : text;

}
