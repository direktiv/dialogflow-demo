## Example

```yaml
id: get-instances-list
functions:
- id: create-context
  image: jkizo/dialog-flow-client:v2
description: "Displays a gcp project instances"
states:
id: post-context
    type: action
    action:
      function: create-context
      input: .
```

## Input

The input needed to run the above workflow properly is the following:

```json
{
       "project": "GCP_PROJECT",
       "serviceAccountKey": "SERVICE_ACCOUNT_KEY",
       "sessionID": "DIALOGFLOW_SESSIONID",
       "contextID": "DIALOGFLOW_CONTEXTID",
       "lifespanCount": 50,
       "contextValue": "hello world"
}
```