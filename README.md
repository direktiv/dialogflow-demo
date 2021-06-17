# dialogflow-demo

This demo is built from four parts:
* GCP Dialogflow Agent ([this is online](https://dialogflow.cloud.google.com/#/agent/development-194922/intents)) : https://dialogflow.cloud.google.com/#/agent/development-194922/intents
    * This handles all of the natural language processing, and the flow of the coversation
* Demo Frontend (`/demo-frontend`) : A React frontend chat interface
    * This is what the users writes into and where the dialogflow responses are displayed
* Demo Server  (`/demo-server`) : A simple golang api / file server
    * This server has two purposes
        1) Serve the built react frontend files
        2) Host an api server that acts as a client for dialogflow
* Demo Context App (`/demo-context-app`) : A dirketiv app that is used to push back context to a dialogflow session
    * The purpose of this app is so that once finished deploying an instance the direktiv workflow can push he returned state value back to dialogflow
    * The returned state value will be set to context named `output`.

