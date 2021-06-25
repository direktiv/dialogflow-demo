FROM golang:1.15-buster as build

WORKDIR /go/src/app
ADD . /go/src/app
RUN go get -d -v 
RUN CGO_ENABLED=0 go build -o /dialog-flow -ldflags="-s -w" main.go

FROM alpine:3.9

COPY --from=build /dialog-flow /

CMD ["/dialog-flow"]