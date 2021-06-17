package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	dialogflow "cloud.google.com/go/dialogflow/apiv2"
	"github.com/vorteil/direktiv-apps/pkg/direktivapps"
	"google.golang.org/api/option"
	dialogflowpb "google.golang.org/genproto/googleapis/cloud/dialogflow/v2"
	"google.golang.org/protobuf/types/known/structpb"
)

// InputContainerDetails ...
type InputContainerDetails struct {
	ServiceAccountKey string `json:"serviceAccountKey"`

	ProjectID     string `json:"projectID"`
	SessionID     string `json:"sessionID"`
	ContextID     string `json:"contextID"`
	ContextValue  string `json:"contextValue"`
	LifespanCount int32  `json:"lifespanCount"`
}

const code = "com.dialogFlowClient.error"

func main() {
	direktivapps.StartServer(DialogFlowCreateContext)
}

func DialogFlowCreateContext(w http.ResponseWriter, r *http.Request) {
	obj := new(InputContainerDetails)
	_, err := direktivapps.Unmarshal(obj, r)
	if err != nil {
		direktivapps.RespondWithError(w, code, err.Error())
		return
	}

	if obj.ProjectID == "" {
		direktivapps.RespondWithError(w, code, "input project cannot be empty")
		return
	}

	err = ioutil.WriteFile("/key.json", []byte(obj.ServiceAccountKey), 0644)
	if err != nil {
		direktivapps.RespondWithError(w, code, fmt.Sprintf("could not write key: %s", err))
		return
	}

	// Create DialogFlow Client
	ctx := context.Background()
	contextClient, err := dialogflow.NewContextsClient(ctx, option.WithCredentialsFile("/key.json"))
	if err != nil {
		direktivapps.RespondWithError(w, code, fmt.Sprintf("failed creating dialogFlow context client: %s", err))
		return
	}

	// Create context request
	request := dialogflowpb.CreateContextRequest{
		Parent: fmt.Sprintf("projects/%s/agent/sessions/%s", obj.ProjectID, obj.SessionID),
		Context: &dialogflowpb.Context{
			LifespanCount: obj.LifespanCount,
			Name:          fmt.Sprintf("projects/%s/agent/sessions/%s/contexts/%s", obj.ProjectID, obj.SessionID, obj.ContextID),
			Parameters: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					obj.ContextID: structpb.NewStringValue(obj.ContextValue),
				},
			},
		},
	}

	// Create Context
	response, err := contextClient.CreateContext(ctx, &request)
	if err != nil {
		direktivapps.RespondWithError(w, code, fmt.Sprintf("failed create context : %s", err.Error()))
		return
	}

	data, err := json.Marshal(response)
	if err != nil {
		direktivapps.RespondWithError(w, code, fmt.Sprintf("failed marshal response : %s", err.Error()))
	}

	direktivapps.Respond(w, data)
}
