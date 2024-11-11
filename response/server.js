const express = require('express');
const bodyParser = require('body-parser');
const kafka = require('kafka-node');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(bodyParser.json());

// Kafka setup
const kafkaHost = process.env.KAFKA_HOST || 'localhost:9092';
const client = new kafka.KafkaClient({ kafkaHost });
const admin = new kafka.Admin(client);
const producer = new kafka.Producer(client);

// Create a topics to avoid any errors when launching Kafka
admin.createTopics([{ topic: 'incidents', partitions: 1, replicationFactor: 1 }], (error, result) => {
    if (error) console.error('Error creating topics:', error);
    else console.log('Topics created or already exist:', result);
});

// Kafka setup for consuming messages from the incident-management service
const consumer = new kafka.Consumer(
    client,
    [{ topic: 'incidents', partition: 0 }],
    { autoCommit: true }
);

// In-memory stores for incidents, blocked IPs, and quarantined areas
const incidents = {}; // Store incidents by ID
const blockedIPs = new Set();       // Store any blocked IP
const quarantinedAreas = new Set(); // Store the quarentined areas

// Function to apply security patches (simulated)
const applySecurityPatch = (details) => {
    console.log(`Applying security patch: ${details}`);
};

// Function to handle IP blocking (simulated)
const blockingIP = (incident) => {
    const suspiciousIP = incident.ip_address;
    blockedIPs.add(suspiciousIP);
    console.log(`Blocked IP: ${suspiciousIP}`);
};

// Function to handle area quarantine (simulated)
const quarantiningArea = (incident) => {
    const affected_area = incident.affected_area;
    quarantinedAreas.add(affected_area);
    console.log(`Quarantined area: ${affected_area}`);
};

// Incident handling with history and status
const handleIncident = (incident) => {
    const { id, incidentType, severity, details } = incident;
    console.log(`Handling incident of type: ${incidentType} with severity: ${severity}`);

    // Set initial incident data if new
    if (!incidents[id]) {
        incidents[id] = {
            id,
            incidentType,
            severity,
            details,
            status: 'Open',
            history: [{ timestamp: new Date(), status: 'Open', changes: 'Incident created' }],
        };
    }

    // Update status and history based on severity
    if (severity === "High") {
        quarantiningArea(incident);
        blockingIP(incident);
        incidents[id].status = 'Escalated';
        incidents[id].history.push({ timestamp: new Date(), status: 'Escalated', changes: 'Incident escalated and actions taken' });
    } else if (severity === "Medium") {
        blockingIP(incident);
        incidents[id].status = 'In Progress';
        incidents[id].history.push({ timestamp: new Date(), status: 'In Progress', changes: 'Blocking IP' });
    } else {
        incidents[id].status = 'Pending Review';
        incidents[id].history.push({ timestamp: new Date(), status: 'Pending Review', changes: 'Pending review due to lower severity' });
    }

    applySecurityPatch(details);
    console.log(`Published security patch for: ${details}`);

    // Respond via Kafka
    producer.send([{ topic: 'responses', messages: JSON.stringify(incidents[id]) }], (error) => {
        if (error) console.error('Error sending message to responses topic:', error);
        else console.log('Response published to responses topic');
    });
};

// Kafka consumer to listen for incidents
consumer.on('message', (message) => {
    console.log('Received incident from Kafka:', message);
    const incident = JSON.parse(message.value);  // Parse the incident message
    handleIncident(incident);
});


// Middleware for error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});


// Endpoint to get blocked IPs and quarantined areas for monitoring
app.get('/monitor', (req, res) => {
    res.json({ blockedIPs: Array.from(blockedIPs), quarantinedAreas: Array.from(quarantinedAreas) });
});

// Endpoint to retrieve incidents with filtering options
app.get('/incidents', (req, res) => {
    const { status, severity, type } = req.query;
    let results = Object.values(incidents);

    if (status) results = results.filter(i => i.status === status);
    if (severity) results = results.filter(i => i.severity === severity);
    if (type) results = results.filter(i => i.incidentType === type);

    res.json(results);
});

// Endpoint to retrieve a specific incident by ID
app.get('/incidents/:id', (req, res) => {
    const incident = incidents[req.params.id];
    if (!incident) return res.status(404).send('Incident not found');
    res.json(incident);
});

// Auto-escalation check for unresolved incidents
const escalateUnresolvedIncidents = () => {
    const currentTime = new Date();

    Object.values(incidents).forEach(incident => {
        const lastUpdate = new Date(incident.history[incident.history.length - 1].timestamp);
        const timeElapsed = (currentTime - lastUpdate) / (1000 * 60); // in minutes

        if (incident.status === 'In Progress' && timeElapsed > 30) {
            incident.status = 'Escalated';
            incident.history.push({ timestamp: currentTime, status: 'Escalated', changes: 'Auto-escalated due to inactivity' });
            console.log(`Incident ID ${incident.id} auto-escalated after 30 minutes of inactivity`);
        }
    });
};

// Check for auto-escalation every 5 minutes
setInterval(escalateUnresolvedIncidents, 5 * 60 * 1000);

// Health-check endpoint
app.get('/', (req, res) => {
    res.send('Response Service is running');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
