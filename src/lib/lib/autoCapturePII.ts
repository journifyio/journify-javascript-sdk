import { Traits } from "../domain/traits";
import { User } from "../domain/user";
import { Browser } from "../transport/browser";

const birthdayRegex =
  /\b(?:n\/a|\d{1,2}[\\/-]\d{1,2}[\\/-](?:\d{2}|\d{4})|\d{4}[\\/-]\d{1,2}[\\/-]\d{1,2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,2}(?:,?\s*(?:\d{2}|\d{4}))?)\b/i;
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const defaultPhoneRegex =
  /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{2,6}$/;
const defaultInputAttrs = [
  "autocomplete",
  "placeholder",
  "name",
  "id",
  "class",
];

export class AutoCapturePII {
  private user: User;
  private browser: Browser;
  private phoneRegex: RegExp;
  // Great article on this https://alephnode.io/07-event-handler-binding/
  private readonly boundOnChange: (e: Event) => void;

  constructor(browser: Browser, user: User, phoneRegex?: string) {
    this.user = user;
    this.browser = browser;
    this.phoneRegex = phoneRegex ? new RegExp(phoneRegex) : defaultPhoneRegex;
    this.boundOnChange = this.onChange.bind(this);
  }
  public listen(): () => void {
    this.browser
      ?.document()
      ?.body?.addEventListener("change", this.boundOnChange, {
        capture: true,
      });
    return () => {
      this.browser
        ?.document()
        ?.body?.removeEventListener("change", this.boundOnChange, {
          capture: true,
        });
    };
  }
  private onChange(e: Event): void {
    const traits: Traits = {};
    // We only want to capture PII from input and select elements
    const possibleTargets = [HTMLInputElement, HTMLSelectElement];
    if (!possibleTargets.some((t) => e.target instanceof t)) {
      return;
    }

    const inputTarget = e.target as HTMLInputElement;
    const selectTarget = e.target as HTMLSelectElement;
    const type = inputTarget?.type || selectTarget?.type;

    // Normalize the value by removing spaces and converting to lowercase
    const split = inputTarget.value.trim().split(" ");
    const value = split.join("").trim().toLocaleLowerCase();

    switch (type) {
      case "text":
        if (
          this.checkInputBy(inputTarget, ["mobile", "tel"], this.phoneRegex) &&
          this.isValidPhone(value)
        ) {
          traits.phone = value;
          break;
        }

        if (
          this.checkInputBy(inputTarget, ["email", "e-mail"], emailRegex) &&
          this.isValidEmail(value)
        ) {
          traits.email = value;
          break;
        }

        if (this.checkInputBy(inputTarget, ["firstname"])) {
          traits.firstname = inputTarget.value.trim();
          break;
        }

        if (this.checkInputBy(inputTarget, ["lastname"])) {
          traits.lastname = inputTarget.value.trim();
          break;
        }

        if (this.checkInputBy(inputTarget, ["name"])) {
          traits.name = inputTarget.value.trim();
          if (split.length > 1) {
            traits.firstname = split[0].trim();
            traits.lastname = split.slice(1).join(" ").trim();
          }

          break;
        }
        break;
      case "email":
        if (this.isValidEmail(value)) {
          traits.email = value;
        }
        break;
      case "tel":
      case "phone":
      case "mobile":
      case "number":
        if (this.isValidPhone(value)) {
          traits.phone = value;
        }
        break;
      case "radio":
      case "checkbox":
        if (this.getGender(value) && inputTarget?.checked) {
          traits.gender = this.getGender(value);
        }
        break;
      case "date":
        if (this.isValidBirthday(inputTarget)) {
          traits.birthday = value;
        }
        break;

      case "select-one":
        this.getSelectValues(selectTarget).forEach((v) => {
          const g = this.getGender(v);
          if (g) {
            traits.gender = g;
          }
        });
        break;
    }

    if (Object.keys(traits).length > 0) {
      this.user.setTraits(traits);
    }
  }
  // Check if the input element has a specific attribute or value that matches the keys
  // If a regex is provided, it will also check if the value matches the regex
  private checkInputBy(
    e: HTMLElement,
    keys: string[],
    regex?: RegExp
  ): boolean {
    for (const key of keys) {
      for (const attr of defaultInputAttrs) {
        const value = e.getAttribute(attr)?.toLowerCase();
        if ((regex && value?.match(regex)) || value?.includes(key)) {
          return true;
        }
      }
    }
    return false;
  }

  private isValidEmail(v: string): boolean {
    return emailRegex.test(v);
  }
  private isValidPhone(v: string): boolean {
    return this.phoneRegex.test(v);
  }
  private isValidBirthday(e: HTMLInputElement): boolean {
    return birthdayRegex.test(e?.value);
  }
  private getGender(value: string): string | null {
    const possibleValues = ["m", "male", "f", "female"];
    if (possibleValues.find((v) => v === value?.toLocaleLowerCase())) {
      return value[0].toLocaleLowerCase(); // return the first letter
    }
    return null;
  }
  // Returns an array with the value and the label of the selected option
  // ex <option value="1" label="male">male</option>
  private getSelectValues(e: HTMLSelectElement): string[] {
    if (e?.selectedIndex === -1) return [];
    return [e?.value, e?.options[e?.selectedIndex]?.label];
  }
}
