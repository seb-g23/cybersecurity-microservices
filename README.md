## Cybersecurity Microservices Project with Kafka Integration

# Overview

This project implements a microservices architecture for a cybersecurity monitoring and incident management system. The microservices communicate via Apache Kafka for real-time event streaming and ensuring scalability. Services include:

    - Threat Detection Service: it detects potential security threats and publishes messages to the "threats" Kafka topic.
    - Incident Management Service: consumes messages from the "threats" topic, manages incidents, and logs details.
    - Response Service: handles automated responses based on incident severity and type.
    - Logging Service: logs important events, incidents, and responses.
    - Notification Service: sends alerts and notifications for critical incidents.


# Project Structure

├── docker-compose.yml
├── threat-detection/
│   ├── Dockerfile
│   ├── server.js
│   ├── node_modules
│   ├── package.json
│   └── package-lock.json
│
├── incident-management/
│   ├── Dockerfile
│   ├── server.js
│   ├── node_modules
│   ├── package.json
│   └── package-lock.json
│
├── response/
│   ├── Dockerfile
│   ├── server.js
│   ├── node_modules
│   ├── package.json
│   └── package-lock.json
│
├── logging/
│   ├── Dockerfile
│   ├── server.js
│   ├── node_modules
│   ├── package.json
│   └── package-lock.json
│
├── notification/
│   ├── Dockerfile
│   ├── server.js
│   ├── .env
│   ├── node_modules
│   ├── package.json
│   └── package-lock.json
│
├── README.md
└── nginx.conf

# Prerequisites

    Make sure you have the following installed:

        - Docker and Docker Compose
        - Node.js 
        - Kafka and Zookeeper setup (configured within Docker Compose)

# Setup and Deployment

1. Build and Start the Services

Run the following command to build and start the services:

--> docker-compose up --build

2. Verify Services Are Running

To confirm all services are running, execute:

--> docker-compose ps

3. Testing Each Microservice

You can test the microservices using Thunder Client (a REST client extension for VS Code).

    A. Threat Detection Service Test

    1. Method: POST
        URL: http://localhost:80/threats
        Body (JSON): {
                        "type": "Malware Detection",
                        "severity": "High",
                        "details": "Detected malicious file attempting to execute on server.",
                        "ip": "10.0.0.5",
                        "area": "Server Room"
                        }
        Expected Response: {
                        "message": "Threat detected and sent to Kafka",
                        "threat": {
                            "id": 1,
                            "type": "Malware Detection",
                            "severity": "High",
                            "details": "Detected malicious file attempting to execute on server.",
                            "ip": "10.0.0.5",
                            "area": "Server Room"
                        }}
        
    2.Method: GET
        URL: http://localhost:80/threats
        Expected Response: [{
                            "id": 1,
                            "type": "Malware Detection",
                            "severity": "High",
                            "details": "Detected malicious file attempting to execute on server.",
                             "ip": "10.0.0.5",
                            "area": "Server Room"
                            }]

    B. Incident Management Service Test

    1. Method: GET
        URL: http://localhost:80/incidents
        Expected Response: [{
                "id": 1,
                "type": "Malware Detection",
                "severity": "High",
                "details": "Detected malicious file attempting to execute on server.",
                "ip_address": "10.0.0.5",
                "affected_area": "Server Room",
                "status": "Open",
                "createdAt": "2024-11-09T14:02:40.302Z",
                "updatedAt": "2024-11-09T14:02:40.302Z"
            }]

   C. Response Service Test

    1. Method: GET
        URL: http://localhost:80/response/incidents
        Expected Response: [
                            {
                                "id": 1,
                                "severity": "High",
                                "details": "Detected malicious file attempting to execute on server.",
                                "status": "Escalated",
                                "history": [
                                {
                                    "timestamp": "2024-11-09T14:02:40.396Z",
                                    "status": "Open",
                                    "changes": "Incident created"
                                },
                                {
                                    "timestamp": "2024-11-09T14:02:40.396Z",
                                    "status": "Escalated",
                                    "changes": "Incident escalated and actions taken"
                                }
                                ]
                            }
                            ]
    2. Method: GET
        URL: http://localhost:80/response/monitor
        Expected Response: {
                            "blockedIPs": [
                                "10.0.0.5"
                            ],
                            "quarantinedAreas": [
                                "Server Room"
                            ]
                            }
    D. Logging Service Test
     1. Method: GET
        URL: http://localhost:80/logging/logs
        Expected Response: [
                            {
                                "topic": "threats",
                                "type": "Malware Detection",
                                "severity": "High",
                                "details": "Detected malicious file attempting to execute on server.",
                                "ip": "10.0.0.5",
                                "area": "Server Room",
                                "timestamp": "2024-11-09T14:02:40.388Z"
                            },
                            {
                                "topic": "incidents",
                                "id": 1,
                                "type": "Malware Detection",
                                "severity": "High",
                                "details": "Detected malicious file attempting to execute on server.",
                                "ip_address": "10.0.0.5",
                                "affected_area": "Server Room",
                                "status": "Open",
                                "createdAt": "2024-11-09T14:02:40.302Z",
                                "updatedAt": "2024-11-09T14:02:40.302Z",
                                "timestamp": "2024-11-09T14:02:40.399Z"
                            },
                            {
                                "topic": "responses",
                                "id": 1,
                                "severity": "High",
                                "details": "Detected malicious file attempting to execute on server.",
                                "status": "Escalated",
                                "history": [
                                {
                                    "timestamp": "2024-11-09T14:02:40.396Z",
                                    "status": "Open",
                                    "changes": "Incident created"
                                },
                                {
                                    "timestamp": "2024-11-09T14:02:40.396Z",
                                    "status": "Escalated",
                                    "changes": "Incident escalated and actions taken"
                                }
                                ],
                                "timestamp": "2024-11-09T14:02:40.489Z"
                            }
                            ]
    E. Notification Service Test
     1. Method: GET
        URL: http://localhost:80/notification
        Expected Response: Notification Service is running

4. Stop the Services

Run the following command to stop the services and remove all containers defined in the docker-compose.yml file : 

    --> docker-compose down

# Kafka Setup 

In this microservices project, Kafka serves as a distributed event streaming platform.
        Zookeeper and Kafka services are defined in the docker-compose.yml file :

        - Zookeeper is responsible for managing and coordinating Kafka brokers, providing essential metadata such as broker information.
        - Kafka handles message publishing and subscribing, serving as a message broker between the microservices.

# Load Balancer Configuration (Nginx)

The nginx.conf file defines load balancing rules for microservices:

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    upstream threat_detection_upstream {
        least_conn;
        server threat-detection:3000;
        server threat-detection:3000;  # Adjust number of instances
    }

    upstream incident_management_upstream {
        least_conn;
        server incident-management:3001;
        server incident-management:3001;
    }

    # Add upstreams for other services

    server {
        listen 80;

        location /threats {
            proxy_pass http://threat_detection_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Add location blocks for other services
    }
}
