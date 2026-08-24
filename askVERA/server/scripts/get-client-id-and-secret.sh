#!/bin/bash

curl -X POST <api-host>/api/askvera/v1/oauth/clients \
  -H "Content-Type: application/json" \
  -H "x-account-id: <your-account-id>" \
  -H "x-api-key: <your-api-key>" \
  -d '{ "description": "Web chat example" }'
