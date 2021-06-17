// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const axios = require('axios');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  
  function sleep(ms) {
  	return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function decodeOutput(agent) {
    var output = null;
    for (const context of agent.contexts) {
      // Seperate context from intent to send to cloud event
      if (context.name === "output") {
        output = context;
        break;
      }
    }
    
    if (output === null) {
      return agent.add("Internal Error has occured, context is not set");
    }
    
    try {
     	var rawLines = Buffer.from(output.parameters.output, "base64").toString().split('\n');
    	rawLines.splice(0,1);
    	var rawJSON = rawLines.join("\n");
    	var outputJSON = JSON.parse(rawJSON);
    
    	const timestamp = outputJSON[0].creationTimestamp;
    	const natIP = outputJSON[0].networkInterfaces[0].accessConfigs[0].natIP;
    	const networkIP = outputJSON[0].networkInterfaces[0].networkIP;
    	const diskSize = outputJSON[0].disks[0].diskSizeGb;
      	const name = outputJSON[0].name;
    
    	return agent.add(`Sucessfully fetched details for instance '${name}'\nDisk Size: ${diskSize}GB\nInternal Address: ${networkIP}\nExternal Address: ${natIP}`);
    } catch(e) {
      	console.log("error = ", e);
        return agent.add(`error? ${e}`);
    }
    }

  function decodeAWSOutput(agent) {
        var output = null;
    
        for (const context of agent.contexts) {
          // Seperate context from intent to send to cloud event
          if (context.name === "output") {
            output = context;
            break;
          }
        }
        
        if (output === null) {
          return agent.add("Internal Error has occured, context is not set");
        }
    
        
        try {
            var outputJSON = JSON.parse(output.parameters.output);
            const privateIP = outputJSON.Instances[0].NetworkInterfaces[0].PrivateIpAddress;
            const instanceId = outputJSON.Instances[0].InstanceId;
          
            return agent.add(`Sucessfully fetched details for instance with id '${instanceId}'\nPrivate Address: ${privateIP}`);
        } catch(e) {
              console.log("error = ", e);
            return agent.add(`error? ${e}`);
        }
    }
 
  function customF(agent) {
    var reqData = {
    specversion: "1.0",
    type: "dialogFlowEvent",
    source: "https://github.com/cloudevents/spec/pull",
    subject: "123",
    id: "A234-1234-1234",
    time: "2018-04-05T17:31:00Z",
    "comexampleextension1": "value",
    comexampleothervalue: 5,
    datacontenttype: "application/json"
	};
    
    // Get parameters from context
    reqData.data = {gcp: null, sessionid: null, aws: null};
    for (const context of agent.contexts) {
      // Seperate context from intent to send to cloud event
      if (context.name === "gcp") {
        reqData.data.gcp = context;
      }
      
      if (context.name === "aws") {
        reqData.data.aws = context;
      }
      
      if (context.name === "sessionid"){
        reqData.data.sessionid = context;
      }
      
      if ((reqData.gcp != null || reqData.aws != null) && reqData.sessionid != null){
        break;
      }
    }
    
    if (!reqData.data) {
      return agent.add("Sorry could not complete command");
    }
    
    return axios({
      method: 'post',
      url: 'https://oz.direktiv.io/api/namespaces/jon/event',
      headers: {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ0b2tlbi03YjRkZDQ4NS01ZGIzLTQwYTgtYjAxZi0zNDBiYTNjOWVhNmMiLCJncm91cHMiOlsidG9rZW4tN2I0ZGQ0ODUtNWRiMy00MGE4LWIwMWYtMzQwYmEzYzllYTZjIl0sImV4cCI6MTkzODQ2NzIyOSwiaXNzIjoiZGlyZWt0aXYifQ.5p8PheVUDzr_WQZjYfCBg5pqRjXRpmOCni0Hzze4n7Q",
               "content-type":"application/json; charset=utf-8"},
      data:  reqData
    }).then(response => {
      
      // Get context if possible
      var output = "No output";
      if (response.data) {
        output = JSON.stringify(response.data);
      }
      
      // return agent.add(`Completed with\nOutput! = ${output}\nstatus = ${response.status}`);
    }).catch(error => {
      return agent.add(`Unfortunately I could not start this instance request.\nError = ${error}`);
    });
  }
  
  function customFGetDetails(agent) {
    return sleep(4500).then(()=>{
      for (const context of agent.contexts) {
        console.log("context.name = ", context.name);
        if (context.name === "output") {
          return agent.add(`cool I got the context`);
        }
      }
      return agent.add(`Unfortunately I dont have the context, would like to keep waiting`);
    });
  }

  let intentMap = new Map();
  intentMap.set('GCP4_User_Input_MachineName', customF);
  intentMap.set('AWS3_User_Input_Image_ID', customF);
  intentMap.set('GCP4_User_Input_MachineName - yes - output', decodeOutput);
  intentMap.set('AWS3_User_Input_Image_ID - yes - output', decodeAWSOutput);
  //intentMap.set('GCP4_User_Input_MachineName - yes', customFGetDetails);
  //intentMap.set('GCP4_User_Input_MachineName - yes - yes', customFGetDetails);
  agent.handleRequest(intentMap);
});
