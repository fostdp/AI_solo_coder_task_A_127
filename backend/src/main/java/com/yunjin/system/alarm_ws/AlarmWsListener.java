package com.yunjin.system.alarm_ws;

import com.yunjin.system.dto.AlertDTO;
import com.yunjin.system.dto.SensorDataDTO;
import com.yunjin.system.entity.Alert;
import com.yunjin.system.entity.Loom;
import com.yunjin.system.event.AlertTriggeredEvent;
import com.yunjin.system.event.SensorDataReceivedEvent;
import com.yunjin.system.event.SimulationStepEvent;
import com.yunjin.system.repository.LoomRepository;
import com.yunjin.system.weaving_simulator.WeavingSimulatorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AlarmWsListener {

    private static final Logger logger = LoggerFactory.getLogger(AlarmWsListener.class);

    private final AlarmEvaluationService alarmEvaluationService;
    private final WebSocketService webSocketService;
    private final LoomRepository loomRepository;
    private final WeavingSimulatorService weavingSimulatorService;

    public AlarmWsListener(AlarmEvaluationService alarmEvaluationService,
                           WebSocketService webSocketService,
                           LoomRepository loomRepository,
                           WeavingSimulatorService weavingSimulatorService) {
        this.alarmEvaluationService = alarmEvaluationService;
        this.webSocketService = webSocketService;
        this.loomRepository = loomRepository;
        this.weavingSimulatorService = weavingSimulatorService;
    }

    @EventListener
    public void onSensorDataReceived(SensorDataReceivedEvent event) {
        SensorDataDTO dto = event.getSensorData();

        webSocketService.broadcastSensorData(dto);

        List<Alert> alerts = alarmEvaluationService.checkAndGenerateAlerts(dto);
        for (Alert alert : alerts) {
            AlertDTO alertDTO = convertAlertToDTO(alert);
            webSocketService.broadcastAlert(alertDTO);
        }

        logger.debug("处理传感器数据事件完成, loomId={}, alertsCount={}", dto.getLoomId(), alerts.size());
    }

    @EventListener
    public void onAlertTriggered(AlertTriggeredEvent event) {
        AlertDTO alert = event.getAlert();
        webSocketService.broadcastAlert(alert);
        logger.debug("处理告警事件完成, alertType={}, loomId={}", alert.getAlertType(), alert.getLoomId());
    }

    @EventListener
    public void onSimulationStep(SimulationStepEvent event) {
        try {
            java.util.Map<String, Object> state = weavingSimulatorService.getSimulationState(event.getLoomId());
            webSocketService.broadcastSimulationUpdate(event.getLoomId(), state);
            logger.debug("处理仿真步骤事件完成, loomId={}, weftRow={}", event.getLoomId(), event.getWeftRow());
        } catch (Exception e) {
            logger.warn("广播仿真更新失败, loomId={}: {}", event.getLoomId(), e.getMessage());
        }
    }

    private AlertDTO convertAlertToDTO(Alert alert) {
        AlertDTO dto = new AlertDTO();
        dto.setId(alert.getId());
        dto.setLoomId(alert.getLoomId());
        dto.setAlertType(alert.getAlertType());
        dto.setAlertLevel(alert.getAlertLevel());
        dto.setMessage(alert.getMessage());
        dto.setResolved(alert.getResolved());
        dto.setCreatedAt(alert.getCreatedAt());

        Optional<Loom> loomOpt = loomRepository.findById(alert.getLoomId());
        loomOpt.ifPresent(l -> dto.setLoomCode(l.getLoomCode()));

        return dto;
    }
}
