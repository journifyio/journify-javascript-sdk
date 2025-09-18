export type Address = {
  city?: string;
  country?: string;
  postalCode?: string;
  state?: string;
  street?: string;
  [k: string]: JSONValue;
};

export type Company = {
  id?: string;
  name?: string;
  industry?: string;
  employee_count?: number;
  plan?: string;
};

export type Traits = object & {
  age?: number;
  birthday?: string;
  city?: string;
  country?: string;
  country_code?: string;
  created_at?: string;
  description?: string;
  email?: string;
  firstname?: string;
  gender?: string;
  lastname?: string;
  id?: string;
  language?: string;
  name?: string;
  phone?: string;
  postal_code?: string;
  state?: string;
  state_code?: string;
  title?: string;
  username?: string;
  website?: string;
  company?: Company;
  address?: Address;
  [k: string]: JSONValue;
};

export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [member: string]: JSONValue };
export type JSONArray = Array<JSONValue>;

export const USER_TRAITS_PERSISTENCE_KEY = "journifyio_user_traits";
export const GROUP_TRAITS_PERSISTENCE_KEY = "journifyio_group_traits";
