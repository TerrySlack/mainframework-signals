import { describe, it, expect, beforeEach, vi } from "vitest";

import { domSignal } from "../dom/index";
import { resetAllStores } from "./helpers/store-reset";

class ReflectedButton extends HTMLElement {
  static get observedAttributes() {
    return ["label"];
  }

  _label = "";

  get label() {
    return this._label;
  }

  set label(value: string) {
    this._label = value;
    this.setAttribute("label", value);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (name === "label") {
      this._label = value ?? "";
    }
  }
}

if (!customElements.get("reflected-button")) {
  customElements.define("reflected-button", ReflectedButton);
}

describe("dom-signal custom element", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("passes through get/set for reflected property not on allowlist", () => {
    const node = document.createElement("reflected-button") as ReflectedButton;
    const dom = domSignal("ce-reflected", node)!;

    dom.label = "hello";

    expect(node.label).toBe("hello");
    expect(dom.label).toBe("hello");
  });

  it("binds forwarded methods to the element", () => {
    const node = document.createElement("button");
    const dom = domSignal("ce-method", node)!;
    const listener = vi.fn();

    const add = dom.addEventListener as typeof node.addEventListener;
    add("click", listener);

    node.click();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
