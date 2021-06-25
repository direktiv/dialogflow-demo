import logo from "./logo.svg";
import direktivLogo from "./img/direktiv.png";
import direktivLogoBig from "./img/direktiv-big.png";
import dialogFlowLogo from "./img/dialogFlow.png";
import logoPanel from "./img/logo-panel.png";

import "./App.css";
import { useState, useCallback, useEffect } from "react";
import { ChatFeed } from "react-bell-chat";

import Particles from "react-particles-js";
import { v4 as uuidv4 } from "uuid";

import { particleParam, particleParam2 } from "./particleparams";
import { Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import { Ellipsis } from "react-css-spinners";

const chatBubbleClasses = {
  userText: "bubble-user-text",
  userChatBubble: "bubble-user-bubble",
  recipientText: "bubble-recipient-text",
  recipientChatBubble: "bubble-recipient-bubble",
};

const sessionId = uuidv4();

function App() {
  const [ssID, setSSID] = useState(sessionId);
  const [isLoading, setIsLoading] = useState(true);
  const [inEndLoop, setInEndLoop] = useState(false);
  const [ended, setEnded] = useState(false);
  console.log(ssID);
  const [messages, setMessages] = useState([]);

  const [authors, setAuthors] = useState([
    {
      id: 1,
      name: "You",
      isTyping: false,
      lastSeenMessageId: 1,
      bgImageUrl: undefined,
    },
    {
      id: 2,
      name: "Direktiv",
      isTyping: false,
      lastSeenMessageId: 2,
      bgImageUrl: undefined,
      isTypingMessage: false,
    },
  ]);

  const [messagePayload, setMessagePayload] = useState("");

  const [currentUser, setCurrentUser] = useState(1);

  const sendToDialogFlow = useCallback(
    (clientMsg) => {
      setAuthors((auth) => {
        auth[1].isTypingMessage = true;
        return [...auth];
      });

      const newMsgID = messages.length + 1;
      console.log("newMsgID =", newMsgID);

      const placeHolderMessage = {
        id: newMsgID,
        authorId: 2,
        message: inEndLoop ? "Fetching Details..." : "Writing Response...",
        createdOn: new Date(),
        isSend: true,
      };
      setMessages([...messages, placeHolderMessage]);

      fetch(`/${ssID}/dialogFlow/`, {
        method: "post",
        body: JSON.stringify({
          Message: clientMsg,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((resp) => resp.json())
        .then(async (resp) => {
          if (inEndLoop) {
            console.log("inside isEndLoop");
            await new Promise((r) => setTimeout(r, 10000));
            fetch(`/${ssID}/dialogFlow/`, {
              method: "post",
              body: JSON.stringify({
                Message: clientMsg,
              }),
              headers: {
                "Content-Type": "application/json",
              },
            })
              .then((respEnd) => respEnd.json())
              .then((respEnd) => {
                // Handle Output context
                for (const context of resp.query_result.output_contexts) {
                  if (context.name.endsWith("output")) {
                    setEnded(true);
                  }
                }
                let respLines =
                  respEnd.query_result.fulfillment_text.split("\n");
                let newMessages = [];
                for (var j = 0; j < respLines.length; j++) {
                  newMessages.push({
                    id: newMsgID + j,
                    authorId: 2,
                    message: respLines[j],
                    createdOn: new Date(),
                    isSend: true,
                  });
                }
                console.log("NEW ERRORR");
                setMessages([...messages, ...newMessages]);
              })
              .catch((error) => {
                console.log("error =", error);
                const newMessage = {
                  id: newMsgID,
                  authorId: 2,
                  message: `Sorry an error seemed to occur: ${error}`,
                  createdOn: new Date(),
                  isSend: true,
                };
                
                setMessages([...messages, newMessage]);
              })
              .finally(() => {
                setAuthors((auth) => {
                  auth[1].isTypingMessage = false;
                  return [...auth];
                });
                setCurrentUser(1);
              });
          } else {
            // Handle Ending Loop
            for (const context of resp.query_result.output_contexts) {
              if (context.name.endsWith("gcp_end") || context.name.endsWith("aws_end")) {
                setInEndLoop(true);
              }
            }

            console.log("resp =", resp);
            let newMessages = [];
            let respLines = resp.query_result.fulfillment_text.split("\n");
            console.log("respLines =", respLines);
            for (var i = 0; i < respLines.length; i++) {
              newMessages.push({
                id: newMsgID + i,
                authorId: 2,
                message: respLines[i],
                createdOn: new Date(),
                isSend: true,
              });
            }
            console.log("ERRORR");
            setMessages([...messages, ...newMessages]);
          }
        })
        .catch((error) => {
          console.log("error =", error);
          const newMessage = {
            id: newMsgID,
            authorId: 2,
            message: `Sorry an error seemed to occur: ${error}`,
            createdOn: new Date(),
            isSend: true,
          };
          setMessages([...messages, newMessage]);
        })
        .finally(() => {
          setAuthors((auth) => {
            auth[1].isTypingMessage = false;
            return [...auth];
          });
          setCurrentUser(1);
        });
    },
    [authors, messages, ssID, inEndLoop]
  );

  const initDialogFlow = useCallback(() => {
    fetch(`/${ssID}/dialogFlow/init`, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((resp) => resp.json())
      .then((resp) => {
        console.log("resp =", resp);
        const newMessage = {
          id: 1,
          authorId: 2,
          message: resp.query_result.fulfillment_text,
          createdOn: new Date(),
          isSend: true,
        };
        setMessages([newMessage]);
      })
      .catch((error) => {
        const newMessage = {
          id: 1,
          authorId: 2,
          message: `Sorry an error seemed to occur: ${error}`,
          createdOn: new Date(),
          isSend: true,
        };
        setMessages([newMessage]);
      })
      .finally(() => {
        setAuthors((auth) => {
          auth[1].isTypingMessage = false;
          return [...auth];
        });
        setCurrentUser(1);
      });
  }, [authors, messages, ssID]);

  const onMessageSubmit = useCallback(
    (e) => {
      async function submitMessage() {
        return {
          id: messages.length + 1,
          authorId: currentUser,
          message: messagePayload,
          createdOn: new Date(),
          isSend: true,
        };
      }

      setCurrentUser(2);

      return submitMessage();
    },
    [messagePayload, currentUser, messages]
  );

  useEffect(() => {
    if (!messages) {
      return;
    }

    if (messages && messages.length == 0) {
      initDialogFlow();
      return;
    }

    if (messages.length > 0) {
      setIsLoading(false);
    }

    if (messages.length > 100) {
      console.log("BOTTTTLE NECK");
      return;
    }

    if (messages[messages.length - 1].authorId == 1) {
      sendToDialogFlow(messages[messages.length - 1].message);
    } else {
      // TODO unlock text area
    }
  }, [messages, sendToDialogFlow]);

  return (
    <div className="App">
      <div className="top">
        <Particles
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1vw",
            height: "1vh",
            zIndex: 0,
          }}
          params={particleParam2}
        />
        <div className="layout">
          <div className="panel info">
            <div className="info-logo">
              <img
                src={logoPanel}
                style={{ width: "45%", padding: "50px" }}
                alt="Logo"
              />
            </div>
            <div className="info-details">
              <p>
              The Direktiv Dialogflow chatbot is an online chatbot that leverages Google's 'Dialogflow' natural language processing chatbot to provide users with a simple approach to deploying online infrastructure.
              </p>
              <p>
              To the right is a demo that you can use to chat with the Direktiv chatbot! It will prompt users for all of the information it requires to deploy a virtual machine instance to either Google Cloud Platform or Amazon Web Services.
              </p>
            </div>
            <div style={{position: "relative", bottom: "0px", left:"0px", zIndex: 110, textAlign: "start", marginLeft: "5px", fontSize: "small", color:"rgb(66, 67, 68)"}}>
              {ssID}
            </div>
          </div>
          <div className="panel chat">
            <div className="chat-inner">
              {isLoading ? (
                <div className={"chat-loading"}>
                  <div>Starting Dialogflow Session</div>
                  <Ellipsis color={"#10a9eb"} />
                </div>
              ) : (
                <>
                  <div className="chat-feed">
                    <div id="chat1" className="chat-feed-inner">
                      <ChatFeed
                        id="chat2"
                        messages={messages}
                        authors={authors}
                        yourAuthorId={1}
                        chatBubbleClasses={chatBubbleClasses}
                        showIsTyping={true}
                      />
                    </div>
                  </div>
                  {ended ? (
                    <div
                      className={"chat-input"}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ color: "white", height: "30px" }}>
                        - Instance created, chat has ended -
                      </div>
                      <Button
                        variant="light"
                        onClick={() => {
                          setIsLoading(true);
                          setSSID(uuidv4());
                          setMessages([]);
                          setInEndLoop(false);
                          setEnded(false);
                          setTimeout(function () {
                            initDialogFlow();
                          }, 5000);
                        }}
                      >
                        Start A New Chat?
                      </Button>
                    </div>
                  ) : (
                    <form
                      className="chat-input"
                      onSubmit={(e) => {
                        onMessageSubmit(e)
                          .then((newMessage) => {
                            setMessages([...messages, newMessage]);
                            setMessagePayload("");
                          })
                          .catch((error) => {
                            console.log("error =", error);
                          });
                        e.preventDefault();
                      }}
                    >
                      <textarea
                        onKeyUp={(e) => {
                          // Hard Coded session reset for debug
                          if (e.key === "Pause") {
                            setIsLoading(true);
                            setSSID(uuidv4());
                            setMessages([]);
                            setInEndLoop(false);
                            setEnded(false);
                            setTimeout(function () {
                              initDialogFlow();
                            }, 5000);
                            return;
                          }
                          if (e.key === "Enter") {
                            onMessageSubmit(e)
                              .then((newMessage) => {
                                setMessages([...messages, newMessage]);
                                setMessagePayload("");
                              })
                              .catch((error) => {
                                console.log("error =", error);
                              });
                          }
                        }}
                        placeholder="Type a message..."
                        disabled={currentUser == 2}
                        className={`chat-message-input ${
                          currentUser == 1 ? "" : "chat-message-input-disabled"
                        }`}
                        value={messagePayload}
                        onChange={(e) => {
                          setMessagePayload(e.target.value);
                        }}
                      />
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
