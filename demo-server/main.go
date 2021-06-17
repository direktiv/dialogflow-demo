package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"

	dialogflow "cloud.google.com/go/dialogflow/apiv2"
	"google.golang.org/api/option"
	dialogflowpb "google.golang.org/genproto/googleapis/cloud/dialogflow/v2"
	"google.golang.org/protobuf/types/known/structpb"
)

//go:embed build/*
var Assets embed.FS

type DialogflowServer struct {
	projectID        string
	authJSONFilePath string
	lang             string
	sessionClient    *dialogflow.SessionsClient
	contextClient    *dialogflow.ContextsClient
	ctx              context.Context
	router           *mux.Router
}

type spaHandler struct {
	staticPath string
	indexPath  string
}

type DialogflowMessage struct {
	Message string
}

type TestSttruct struct {
	Message string
}

func main() {
	var err error
	server := DialogflowServer{
		projectID:        "development-194922",
		authJSONFilePath: "./key.json",
		lang:             "en-US",
		ctx:              context.Background(),
		router:           mux.NewRouter(),
	}

	// Load Config
	if kPath := os.Getenv("KEY_PATH"); kPath != "" {
		log.Println("loaded key path from KEY_PATH")
		server.authJSONFilePath = kPath
	} else {
		log.Printf("loaded key path from defaults '%s'\n", server.authJSONFilePath)
	}

	if project := os.Getenv("KEY_PATH"); project != "" {
		log.Println("loaded project from DIALOG_PROJECT")
		server.projectID = project
	} else {
		log.Printf("loaded project from defaults '%s'\n", server.projectID)
	}

	server.sessionClient, err = dialogflow.NewSessionsClient(server.ctx, option.WithCredentialsFile(server.authJSONFilePath))
	if err != nil {
		log.Fatal("Error in auth with Dialogflow")
	}

	server.contextClient, err = dialogflow.NewContextsClient(server.ctx, option.WithCredentialsFile(server.authJSONFilePath))
	if err != nil {
		log.Fatal("Error in context auth with Dialogflow")
	}

	// Init Routes
	server.router.HandleFunc("/{sessionID}/dialogFlow/init", server.DialogInit).Methods("GET", "OPTIONS")
	server.router.HandleFunc("/{sessionID}/dialogFlow/", server.DialogPostMessage).Methods("POST", "OPTIONS")
	server.router.HandleFunc("/{sessionID}/context/{context}", server.DialogGetContext).Methods("GET", "OPTIONS")
	server.router.HandleFunc("/{sessionID}/context/{context}", server.DialogPostContext).Methods("POST", "OPTIONS")
	spa := spaHandler{staticPath: "build", indexPath: "index.html"}

	server.router.PathPrefix("/").Handler(spa)

	server.router.Use(mux.CORSMethodMiddleware(server.router))

	log.Println("Starting sever on :8373 ...")
	log.Fatal(http.ListenAndServe(":8373", server.router))
}

func (s DialogflowServer) AssetHandler(w http.ResponseWriter, r *http.Request) {
	// get the absolute path to prevent directory traversal
	path, err := filepath.Abs(r.URL.Path)
	if err != nil {
		// if we failed to get the absolute path respond with a 400 bad request
		// and stop
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// prepend the path with the path to the static directory
	path = filepath.Join("/build", path)

	// check whether a file exists at the given path
	_, err = os.Stat(path)
	if os.IsNotExist(err) {
		// file does not exist, serve index.html
		http.ServeFile(w, r, filepath.Join("/build", "./index.html"))
		return
	} else if err != nil {
		// if we got an error (that wasn't that the file doesn't exist) stating the
		// file, return a 500 internal server error and stop
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// otherwise, use http.FileServer to serve the static dir
	http.FileServer(http.Dir("/build")).ServeHTTP(w, r)
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// get the absolute path to prevent directory traversal
	path, err := filepath.Abs(r.URL.Path)
	if err != nil {
		// if we failed to get the absolute path respond with a 400 bad request
		// and stop
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// prepend the path with the path to the static directory
	path = filepath.Join(h.staticPath, path)

	// check whether a file exists at the given path
	_, err = os.Stat(path)
	if os.IsNotExist(err) {
		// file does not exist, serve index.html
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		// if we got an error (that wasn't that the file doesn't exist) stating the
		// file, return a 500 internal server error and stop
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// otherwise, use http.FileServer to serve the static dir
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

// DialogPostContext - Post a context to the session
func (s DialogflowServer) DialogPostContext(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	contextID := vars["context"]

	log.Printf("Route: %s , SessionID: %s , ContextID: %s\n", r.URL, sessionID, contextID)

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		return
	}

	request := dialogflowpb.CreateContextRequest{
		Parent: fmt.Sprintf("projects/%s/agent/sessions/%s", s.projectID, sessionID),
		Context: &dialogflowpb.Context{
			LifespanCount: 10,
			Name:          fmt.Sprintf("projects/%s/agent/sessions/%s/contexts/%s", s.projectID, sessionID, contextID),
			Parameters: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					contextID: structpb.NewStringValue("hello world"),
				},
			},
		},
	}

	response, err := s.contextClient.CreateContext(s.ctx, &request)
	if err != nil {
		log.Printf("Error in communication with Dialogflow %s\n", err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DialogGetContext - get a context from a session
func (s DialogflowServer) DialogGetContext(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	contextID := vars["context"]

	log.Printf("Route: %s , SessionID: %s , ContextID: %s\n", r.URL, sessionID, contextID)

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		return
	}

	request := dialogflowpb.GetContextRequest{
		Name: fmt.Sprintf("projects/%s/agent/sessions/%s/contexts/%s", s.projectID, sessionID, contextID),
	}

	response, err := s.contextClient.GetContext(s.ctx, &request)
	if err != nil {
		log.Printf("Error in communication with Dialogflow %s\n", err.Error())
		w.WriteHeader(http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DialogInit - init a session, by setting welcome intent and saving sessionID in context
func (s DialogflowServer) DialogInit(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]

	log.Printf("Route: %s , SessionID: %s\n", r.URL, sessionID)

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		return
	}

	// save sessionID var
	ctxRequest := dialogflowpb.CreateContextRequest{
		Parent: fmt.Sprintf("projects/%s/agent/sessions/%s", s.projectID, sessionID),
		Context: &dialogflowpb.Context{
			LifespanCount: 1000,
			Name:          fmt.Sprintf("projects/%s/agent/sessions/%s/contexts/%s", s.projectID, sessionID, "sessionid"),
			Parameters: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"sessionid": structpb.NewStringValue(sessionID),
				},
			},
		},
	}

	_, err := s.contextClient.CreateContext(s.ctx, &ctxRequest)
	if err != nil {
		log.Printf("Error in communication with Dialogflow %s\n", err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	request := dialogflowpb.DetectIntentRequest{
		Session: fmt.Sprintf("projects/%s/agent/sessions/%s", s.projectID, sessionID),
		QueryInput: &dialogflowpb.QueryInput{
			Input: &dialogflowpb.QueryInput_Text{
				Text: &dialogflowpb.TextInput{
					Text:         "hello",
					LanguageCode: s.lang,
				},
			},
		},
	}

	response, err := s.sessionClient.DetectIntent(s.ctx, &request)
	if err != nil {
		log.Fatalf("Error in communication with Dialogflow %s", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DialogPostMessage - Post message to sessions and reply with response text
func (s DialogflowServer) DialogPostMessage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]

	log.Printf("Route: %s , SessionID: %s\n", r.URL, sessionID)

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		return
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body",
			http.StatusInternalServerError)
	}

	var m DialogflowMessage
	err = json.Unmarshal(body, &m)
	if err != nil {
		panic(err)
	}

	request := dialogflowpb.DetectIntentRequest{
		Session: fmt.Sprintf("projects/%s/agent/sessions/%s", s.projectID, sessionID),
		QueryInput: &dialogflowpb.QueryInput{
			Input: &dialogflowpb.QueryInput_Text{
				Text: &dialogflowpb.TextInput{
					Text:         m.Message,
					LanguageCode: s.lang,
				},
			},
		},
	}

	response, err := s.sessionClient.DetectIntent(s.ctx, &request)
	if err != nil {
		log.Fatalf("Error in communication with Dialogflow %s", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
