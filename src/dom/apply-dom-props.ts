import type { DomProps } from "./types";

const STRING_KEYS = new Set<keyof DomProps>([
  "textContent",
  "innerHTML",
  "className",
  "id",
  "value",
  "src",
  "href",
  "alt",
  "title",
  "placeholder",
  "type",
  "name",
  "htmlFor",
]);

const BOOLEAN_KEYS = new Set<keyof DomProps>(["hidden", "checked", "disabled"]);

export const DOM_PROP_ALLOWLIST = new Set<string>([...STRING_KEYS, ...BOOLEAN_KEYS, "tabIndex"]);

export const applyDomProps = (element: HTMLElement, props: DomProps): void => {
  for (const key of Object.keys(props) as (keyof DomProps)[]) {
    applyDomProp(element, key, props[key]);
  }
};

export const applyDomProp = (element: HTMLElement, key: keyof DomProps, value: DomProps[keyof DomProps]): void => {
  if (value === undefined) {
    return;
  }

  if (key === "tabIndex") {
    if (value === null) {
      element.removeAttribute("tabindex");
      return;
    }

    element.tabIndex = value as number;
    return;
  }

  if (BOOLEAN_KEYS.has(key)) {
    (element as unknown as Record<string, boolean>)[key] = value === null ? false : Boolean(value);
    return;
  }

  if (STRING_KEYS.has(key)) {
    (element as unknown as Record<string, string>)[key] = value === null ? "" : String(value);
  }
};
