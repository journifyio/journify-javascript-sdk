/* eslint-disable  @typescript-eslint/no-explicit-any */
import { AutoCapturePII } from "../autoCapturePII";

describe("AutoCapturePII", () => {
  let userMock: any;
  let browserMock: any;
  let documentMock: any;
  let bodyMock: any;

  beforeEach(() => {
    document.body.innerHTML = ``;
    userMock = {
      setTraits: jest.fn(),
    };

    bodyMock = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    documentMock = {
      ...document,
      body: bodyMock,
    };

    browserMock = {
      document: jest.fn().mockReturnValue(documentMock),
    };
  });

  it("should listen and stop capturing events", () => {
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    const stop = autoCapture.listen();

    expect(documentMock.body.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
      { capture: true }
    );

    stop();

    expect(documentMock.body.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
      { capture: true }
    );
  });

  it("should set user traits when input text and value is valid email", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "email",
      type: "text",
      value: "test@example.com",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      email: "test@example.com",
    });
  });

  it("should set the firstname trait when input firstname and value is not empty", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "firstname",
      type: "text",
      value: "   Said",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      firstname: "Said",
    });
  });

  it("should set the lastname trait when input lastname and value is not empty", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "lastname",
      type: "text",
      value: " Benani Smires ",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      lastname: "Benani Smires",
    });
  });

  it("should set the firstname trait when input has spaces", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "firstname",
      type: "text",
      value: " Said Gates Armani ",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      firstname: "Said Gates Armani",
    });
  });

  it("should set the firstname and lastname traits when input is name", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "name",
      type: "text",
      value: " Said Gates Armani ",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      name: "Said Gates Armani",
      firstname: "Said",
      lastname: "Gates Armani",
    });
  });

  it("should set user traits when input text and value is invalid email", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "email",
      type: "text",
      value: "test",
    });

    expect(userMock.setTraits).not.toHaveBeenCalled();
  });

  it("should set user traits when input email and value is valid email", () => {
    browserMock.document = jest.fn().mockReturnValue(document);

    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "email",
      type: "email",
      value: "valid@journify.io",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      email: "valid@journify.io",
    });
  });

  it("should set user traits when phone is valid", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "telephone",
      type: "tel",
      value: "+1234567890",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      phone: "+1234567890",
    });
  });

  it("should set user traits when input is text and valid phone", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "telephone",
      type: "text",
      placeholder: "phone",
      value: "+1234567890",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      phone: "+1234567890",
    });
  });

  it("should not set user traits when phone is invalid", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "telephone",
      type: "text",
      placeholder: "phone",
      value: "invalid phone",
    });

    expect(userMock.setTraits).not.toHaveBeenCalled();
  });
  it("should set gender when radio button is checked", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeSelectOnDocument({
      id: "gender",
      options: ["f", "m"],
      value: "f",
    });
    expect(userMock.setTraits).toHaveBeenCalledWith({
      gender: "f",
    });
  });
  it("should not set gender when radio button is not checked", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeSelectOnDocument({
      id: "gender",
      options: ["f", "m"],
      value: null,
    });
    expect(userMock.setTraits).not.toHaveBeenCalled();
  });
  it("should not set gender when options are not valid", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeSelectOnDocument({
      id: "gender",
      options: ["invalid", "invalid"],
      value: "invalid",
    });
    expect(userMock.setTraits).not.toHaveBeenCalled();
  });

  it("should set birthday when input is date and valid", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "birthday",
      type: "date",
      value: "2020-01-01",
    });

    expect(userMock.setTraits).toHaveBeenCalledWith({
      birthday: "2020-01-01",
    });
  });

  it("should not set birthday when input is date and invalid", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();

    writeInputOnDocument({
      id: "birthday",
      type: "date",
      value: "invalid",
    });

    expect(userMock.setTraits).not.toHaveBeenCalled();
  });
  it("should set email when class is very long", () => {
    browserMock.document = jest.fn().mockReturnValue(document);
    const autoCapture = new AutoCapturePII(browserMock, userMock);
    autoCapture.listen();
    writeInputOnDocument({
      id: "email",
      type: "text",
      className:
        "MuiInputBase-input MuiOutlinedInput-input MuiInputBase MuiInputBase-inputAdornedEnd css-1uvydh2 css-3fghb2 css-8jkls1 css-9plmxa css-4mn8yz css-6bqvpt css-2kdjwh css-7xvyz9 css-5lmno3 css-1abcde css-0xyz78 css-1pqrs9 MuiOutlinedInput-root MuiOutlinedInput-notchedOutline MuiInputBase-root MuiInputBase-formControl MuiInputBase-multiline MuiInputBase-adornedStart MuiInputBase-adornedEnd MuiOutlinedInput-multiline MuiInputBase-inputType MuiInputBase-inputSizeSmall MuiInputBase-inputAdornedStart MuiInputBase-fullWidth",
    });
    expect(userMock.setTraits).not.toHaveBeenCalled();
  });
});

function writeSelectOnDocument({ id, options, value }: any) {
  document.body.innerHTML = `
        <select id="${id}">
            ${options
              .map((o: any) => `<option value="${o}">${o}</option>`)
              .join("")}
        </select>
        `;
  const el = document.querySelector(`#${id}`) as HTMLSelectElement;
  el.value = value;
  el.dispatchEvent(new Event("change"));
}
function writeInputOnDocument({
  id,
  type,
  value,
  autocomplete,
  placeholder,
  className,
}: any) {
  document.body.innerHTML = `
        <input id="${id}" 
        type="${type}"
         value="${value}"
          autocomplete="${autocomplete}"
          placeholder="${placeholder}",
          class="${className}"
          />
        `;
  const el = document.querySelector(`#${id}`);
  el?.dispatchEvent(new Event("change"));
}
