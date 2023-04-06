export type CHIPValue = string | number | boolean | null;

// recursive structure representing a generic json object
export type CHIPData = Record<string, unknown | Array<unknown>>;

export type CHIPParsedResult = Array<CHIPData>;
