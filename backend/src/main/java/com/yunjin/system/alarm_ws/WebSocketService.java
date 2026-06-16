package com.yunjin.system.alarm_ws;

import com.yunjin.system.dto.AlertDTO;
import com.yunjin.system.dto.SensorDataDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class WebSocketService {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketService.class);

    private final SimpMessagingTemplate messagingTemplate;

    private static final String TOPIC_SENSOR_PREFIX = "/topic/sensor/";
    private static final String TOPIC_ALERTS = "/topic/alerts";
    private static final String TOPIC_SIMULATION_PREFIX = "/topic/simulation/";

    @Autowired
    public WebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void broadcastSensorData(SensorDataDTO dto) {
        if (dto == null || dto.getLoomId() == null) {
            logger.warn("Cannot broadcast sensor data: DTO or loomId is null");
            return;
        }

        String destination = TOPIC_SENSOR_PREFIX + dto.getLoomId();
        try {
            messagingTemplate.convertAndSend(destination, dto);
            logger.debug("Broadcast sensor data to {} for loomId: {}", destination, dto.getLoomId());
        } catch (Exception e) {
            logger.error("Failed to broadcast sensor data for loomId {}: {}", dto.getLoomId(), e.getMessage(), e);
        }
    }

    public void broadcastAlert(AlertDTO alert) {
        if (alert == null) {
            logger.warn("Cannot broadcast alert: AlertDTO is null");
            return;
        }

        try {
            messagingTemplate.convertAndSend(TOPIC_ALERTS, alert);
            logger.debug("Broadcast alert to {}: alertId={}, type={}, loomId={}",
                    TOPIC_ALERTS, alert.getId(), alert.getAlertType(), alert.getLoomId());
        } catch (Exception e) {
            logger.error("Failed to broadcast alert: {}", e.getMessage(), e);
        }
    }

    public void broadcastSimulationUpdate(Long loomId, Object state) {
        if (loomId == null) {
            logger.warn("Cannot broadcast simulation update: loomId is null");
            return;
        }
        if (state == null) {
            logger.warn("Cannot broadcast simulation update: state is null for loomId {}", loomId);
            return;
        }

        String destination = TOPIC_SIMULATION_PREFIX + loomId;
        try {
            messagingTemplate.convertAndSend(destination, state);
            logger.debug("Broadcast simulation update to {} for loomId: {}", destination, loomId);
        } catch (Exception e) {
            logger.error("Failed to broadcast simulation update for loomId {}: {}", loomId, e.getMessage(), e);
        }
    }

    public void broadcastToCustomTopic(String topic, Object payload) {
        if (topic == null || topic.isEmpty()) {
            logger.warn("Cannot broadcast to custom topic: topic is null or empty");
            return;
        }
        if (payload == null) {
            logger.warn("Cannot broadcast to topic {}: payload is null", topic);
            return;
        }

        try {
            String fullTopic = topic.startsWith("/topic/") ? topic : "/topic/" + topic;
            messagingTemplate.convertAndSend(fullTopic, payload);
            logger.debug("Broadcast to custom topic {} completed", fullTopic);
        } catch (Exception e) {
            logger.error("Failed to broadcast to topic {}: {}", topic, e.getMessage(), e);
        }
    }

    public SimpMessagingTemplate getMessagingTemplate() {
        return messagingTemplate;
    }
}
