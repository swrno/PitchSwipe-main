/**
 * Standard lists shared by swipers and founders (spec/03 §5.12, spec/08 §13.5).
 * Nothing in the app is free text for these fields. Lists change only through a
 * product update, never by typing a new value.
 */

export const ROLES = [
  "Shop owner",
  "Wholesaler",
  "Business owner",
  "Salaried",
  "Freelancer",
  "Student",
  "Doctor",
  "Driver",
  "Homemaker",
  "Farmer",
  "Other",
] as const;
export type Role = (typeof ROLES)[number];

export const INDUSTRIES = [
  "Retail",
  "Finance",
  "Food",
  "Healthcare",
  "Logistics",
  "Travel",
  "Education",
  "Fashion",
  "Real estate",
  "Agriculture",
  "SaaS",
  "Gaming",
  "Fitness",
  "Beauty",
  "Pets",
  "Kids",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Indian states and union territories (28 states + 8 UTs), alphabetical. */
export const STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;
export type State = (typeof STATES)[number];

/** The seven test types a deck can change (exactly one per deck). */
export const TEST_VARIABLES = [
  "headline",
  "description",
  "reward",
  "price",
  "productUI",
  "logo",
  "language",
] as const;
export type TestVariable = (typeof TEST_VARIABLES)[number];

export const TEST_VARIABLE_LABELS: Record<TestVariable, string> = {
  headline: "Headline",
  description: "Description",
  reward: "Reward",
  price: "Price",
  productUI: "Product UI",
  logo: "Logo",
  language: "Language",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isIndustry(value: string): value is Industry {
  return (INDUSTRIES as readonly string[]).includes(value);
}

export function isState(value: string): value is State {
  return (STATES as readonly string[]).includes(value);
}
