import React, { Fragment, ReactElement } from "react";
import "./App.css";

// @journifyio/js-sdk is linked using npm link (check `start` script on package.json)
import * as journify from "@journifyio/js-sdk";

function App() {
  return (
    <div className="App">
      <Loader />
      {operations.map((operation) => (
        <Fragment key={operation.title}>
          <h1 key={operation.title + "-H1"}>{operation.title}</h1>
          <Operation {...operation} />
        </Fragment>
      ))}
    </div>
  );
}

function Loader(): ReactElement {
  return (
    <>
      <h1>Load</h1>
      <div className={"operation"}>
        <div className={"operation-input-container"}>
          <label>API host</label>
          <select id={inputIds.load.apiHost}>
            <option>t.lvh.me</option>
            <option>t.journify.dev</option>
            <option>t.journify.io</option>
          </select>
        </div>
        <div className={"operation-input-container"}>
          <label>CDN host</label>
          <select id={inputIds.load.cdnHost}>
            <option>local.journify.dev</option>
            <option>static.journify.dev</option>
            <option>static.journify.io</option>
          </select>
        </div>
        <div className={"operation-input-container"}>
          <label>Write key</label>
          <input
            id={inputIds.load.writeKey}
            className={"write-key-input"}
            placeholder={"Write key"}
          />
        </div>
        <div className={"operation-input-container"}>
          <label>Cookie domain</label>
          <input
            id={inputIds.load.cookieDomain}
            className={"write-key-input"}
            placeholder={"localhost.com"}
          />
        </div>
        <div className={"operation-input-container"}>
          <label>Hash PII</label>
          <input
            id={inputIds.load.enableHashing}
            className={"hash-pii-checkbox"}
            type={"checkbox"}
          />
        </div>

        <SubmitButton label="Load" onClickCallback={callbacks.load} />
        <label id={outputIds.load} />
      </div>
    </>
  );
}

function Operation(props: OperationProps): ReactElement {
  const elements: ReactElement[] = [];
  props.content.forEach((_, i) => {
    elements.push(
      <OperationInput key={props.content[i].title} content={props.content[i]} />
    );
  });

  return (
    <div className={"operation"}>
      {elements}
      <SubmitButton
        label={props.title}
        onClickCallback={props.submitCallback}
      />
      <label id={props.outputId} />
    </div>
  );
}

function OperationInput(props: OperationInputProps): ReactElement {
  let elt: ReactElement = (
    <div className={"operation-input-container"}>
      <label>{props.content.title}</label>
      <input
        className={"operation-input"}
        id={props.content.id}
        placeholder={props.content.placeholder}
      />
    </div>
  );

  if (props.content.type === "textarea") {
    elt = (
      <div className={"operation-input-container"}>
        <label>{props.content.title}</label>
        <textarea
          className={"operation-input"}
          id={props.content.id}
          defaultValue={props.content.placeholder}
        ></textarea>
      </div>
    );
  }

  return elt;
}

function SubmitButton(props: SubmitButtonProps) {
  return <button onClick={props.onClickCallback}>{props.label}</button>;
}

type OperationProps = {
  title: string;
  content: OperationContent[];
  submitCallback: (...args: any) => any;
  outputId: string;
};

type OperationInputProps = {
  content: OperationContent;
  key: string;
};

type SubmitButtonProps = {
  label: string;
  onClickCallback: (...args: any) => any;
};

type OperationContent = {
  id: string;
  title: string;
  type: "input" | "textarea" | "checkbox";
  placeholder: string;
};

const inputIds = {
  load: {
    writeKey: "load-write-key",
    apiHost: "api-host-select",
    cdnHost: "cdn-host-select",
    cookieDomain: "load-cookie-domain",
    enableHashing: "load-enable-hashing",
  },
  identify: {
    userId: "identify-user-id",
    traits: "identify-traits",
    externalIds: "identify-external-id",
  },
  group: {
    groupId: "group-id",
    traits: "group-traits",
  },
  track: {
    eventName: "event-name",
    eventProperties: "event-properties",
    traits: "event-user-traits",
  },
  page: {
    pageName: "page-name",
    pageProperties: "page-properties",
    traits: "page-user-traits",
  },
};

const outputIds = {
  load: "load-output",
  identify: "identify-output",
  group: "group-output",
  track: "track-output",
  page: "page-output",
};

const callbacks = {
  load: () => {
    const hashingCheckbox = document.getElementById(
      inputIds.load.enableHashing
    ) as HTMLInputElement;
    const settings: journify.SdkSettings = {
      writeKey: getInputValue<HTMLInputElement>(inputIds.load.writeKey),
      options: {
        autoCapturePII: true,
        autoCapturePhoneRegex: "^05\\d{8}$",
        phoneCountryCode: "212",
        enableHashing: hashingCheckbox.checked,
        cookie: {
          domain: getInputValue<HTMLInputElement>(inputIds.load.cookieDomain),
        },
      },
    };

    const apiHost = getInputValue<HTMLSelectElement>(inputIds.load.apiHost);
    if (apiHost) {
      settings.apiHost = "https://" + apiHost;
    }

    const cdnHost = getInputValue<HTMLSelectElement>(inputIds.load.cdnHost);
    if (cdnHost) {
      settings.cdnHost = "https://" + cdnHost;
    }

    journify
      .load(settings)
      .then(() => {
        showSuccessMessage(outputIds.load, "Load is done");
      })
      .catch((err) => {
        showErrorMessage(outputIds.load, err);
      });
  },

  identify: () => {
    const userId = getInputValue<HTMLInputElement>(
      inputIds.identify.userId
    ).toString();

    let externalIds;
    const externalInput = getInputValue<HTMLInputElement>(
      inputIds.identify.externalIds
    );
    if (externalInput) {
      externalIds = JSON.parse(externalInput);
    }

    let traits;
    const traitsInput = getInputValue<HTMLTextAreaElement>(
      inputIds.identify.traits
    );
    if (traitsInput) {
      traits = JSON.parse(traitsInput);
    }

    journify
      .identify(userId, traits, externalIds)
      .then((ctx) => {
        if (!ctx) {
          showErrorMessage(
            outputIds.identify,
            "context is null because you didn't call load"
          );
          return;
        }

        const failedDelivery = ctx.getFailedDelivery();
        if (failedDelivery) {
          showErrorMessage(outputIds.identify, failedDelivery.reason);
        } else {
          showSuccessMessage(
            outputIds.identify,
            "identify call succeeded, context id: " + ctx.getId()
          );
        }
      })
      .catch((err) => {
        showErrorMessage(outputIds.identify, err);
      });
  },

  group: () => {
    const groupId = getInputValue<HTMLInputElement>(inputIds.group.groupId);

    let traits;
    const traitsInput = getInputValue<HTMLTextAreaElement>(
      inputIds.group.traits
    );
    if (traitsInput) {
      traits = JSON.parse(traitsInput);
    }

    journify
      .group(groupId, traits)
      .then((ctx) => {
        if (!ctx) {
          showErrorMessage(
            outputIds.group,
            "context is null because you didn't call load"
          );
          return;
        }

        const failedDelivery = ctx.getFailedDelivery();
        if (failedDelivery) {
          showErrorMessage(outputIds.group, failedDelivery.reason);
        } else {
          showSuccessMessage(
            outputIds.group,
            "group call succeeded, context id: " + ctx.getId()
          );
        }
      })
      .catch((err) => {
        showErrorMessage(outputIds.group, err);
      });
  },

  track: () => {
    const eventName = getInputValue<HTMLInputElement>(inputIds.track.eventName);

    let eventProperties;
    const propsInput = getInputValue<HTMLTextAreaElement>(
      inputIds.track.eventProperties
    );
    if (propsInput) {
      eventProperties = JSON.parse(propsInput);
    }

    let traits;
    const traitsInput = getInputValue<HTMLTextAreaElement>(
      inputIds.track.traits
    );
    if (traitsInput) {
      traits = JSON.parse(traitsInput);
    }

    journify
      .track(eventName, eventProperties, traits)
      .then((ctx) => {
        if (!ctx) {
          showErrorMessage(
            outputIds.track,
            "context is null because you didn't call load"
          );
          return;
        }

        const failedDelivery = ctx.getFailedDelivery();
        if (failedDelivery) {
          showErrorMessage(outputIds.track, failedDelivery.reason);
        } else {
          showSuccessMessage(
            outputIds.track,
            "track call succeeded, context id: " + ctx.getId()
          );
        }
      })
      .catch((err) => {
        showErrorMessage(outputIds.track, err);
      });
  },

  page: () => {
    const pageName = getInputValue<HTMLInputElement>(inputIds.page.pageName);

    let pageProperties;
    const propsInput = getInputValue<HTMLTextAreaElement>(
      inputIds.page.pageProperties
    );
    if (propsInput) {
      pageProperties = JSON.parse(propsInput);
    }

    let traits;
    const traitsInput = getInputValue<HTMLTextAreaElement>(
      inputIds.page.traits
    );
    if (traitsInput) {
      traits = JSON.parse(traitsInput);
    }

    journify
      .page(pageName, pageProperties, traits)
      .then((ctx) => {
        if (!ctx) {
          showErrorMessage(
            outputIds.page,
            "context is null because you didn't call load"
          );
          return;
        }

        const failedDelivery = ctx.getFailedDelivery();
        if (failedDelivery) {
          showErrorMessage(outputIds.page, failedDelivery.reason);
        } else {
          showSuccessMessage(
            outputIds.page,
            "page call succeeded, context id: " + ctx.getId()
          );
        }
      })
      .catch((err) => {
        showErrorMessage(outputIds.page, err);
      });
  },
};

function showErrorMessage(elementId: string, err: any) {
  showMessage(elementId, err, "error");
}

function showSuccessMessage(elementId: string, message: string) {
  showMessage(elementId, message, "success");
}

function showMessage(elementId: string, message: any, newClassName: string) {
  const output = document.getElementById(elementId) as HTMLLabelElement;
  output.className = newClassName;
  output.innerText = message;
  setTimeout(() => {
    output.innerText = "";
  }, 10000);
}

type InputType = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function getInputValue<T extends InputType>(id: string): string {
  const input = document.getElementById(id) as T;
  return input?.value;
}

const operations: OperationProps[] = [
  {
    title: "Identify",
    content: [
      {
        id: inputIds.identify.userId,
        title: "User ID",
        type: "input",
        placeholder: "user id",
      },
      {
        id: inputIds.identify.traits,
        title: "Traits",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            name: "Adam Smith",
            email: "adam@example.com",
            plan: "enterprise",
          },
          null,
          "\t"
        ),
      },
      {
        id: inputIds.identify.externalIds,
        title: "External IDs",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            snapchat_advertiser_cookie_1: "snap_cookie_1",
            facebook_browser_id: "facebook browser ID",
          },
          null,
          "\t"
        ),
      },
    ],
    submitCallback: callbacks.identify,
    outputId: outputIds.identify,
  },
  {
    title: "Group",
    content: [
      {
        id: inputIds.group.groupId,
        title: "Group ID",
        type: "input",
        placeholder: "group id",
      },
      {
        id: inputIds.group.traits,
        title: "Group traits",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            name: "Group",
            email: "group@example.com",
            plan: "enterprise",
          },
          null,
          "\t"
        ),
      },
    ],
    submitCallback: callbacks.group,
    outputId: outputIds.group,
  },
  {
    title: "Track",
    content: [
      {
        id: inputIds.track.eventName,
        title: "Event name",
        type: "input",
        placeholder: "Event name",
      },
      {
        id: "phone-input",
        title: "Phone",
        type: "input",
        placeholder: "Phone",
      },
      {
        id: inputIds.track.eventProperties,
        title: "Event properties",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            title: "Wealth of Nations",
            author: "Adam Smith",
          },
          null,
          "\t"
        ),
      },
      {
        id: inputIds.track.traits,
        title: "Traits",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            userId: "928376389200929",
            email: "adam@example.com",
            phone: "+212536398829",
          },
          null,
          "\t"
        ),
      },
    ],
    submitCallback: callbacks.track,
    outputId: outputIds.track,
  },
  {
    title: "Page",
    content: [
      {
        id: inputIds.page.pageName,
        title: "Page name",
        type: "input",
        placeholder: "Page name",
      },
      {
        id: inputIds.page.pageProperties,
        title: "Page properties",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            source: "Google",
            path: "/hello-world",
          },
          null,
          "\t"
        ),
      },
      {
        id: inputIds.page.traits,
        title: "Traits",
        type: "textarea",
        placeholder: JSON.stringify(
          {
            userId: "928376389200929",
            email: "adam@example.com",
            phone: "+212536398829",
          },
          null,
          "\t"
        ),
      },
    ],
    submitCallback: callbacks.page,
    outputId: outputIds.page,
  },
];

export default App;
