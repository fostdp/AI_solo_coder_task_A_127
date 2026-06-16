package com.yunjin.system.weaving_simulator;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunjin.system.dto.SensorDataDTO;
import com.yunjin.system.entity.SensorData;
import com.yunjin.system.event.SensorDataReceivedEvent;
import com.yunjin.system.event.SimulationStepEvent;
import com.yunjin.system.repository.SensorDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WeavingSimulatorListener {

    private static final Logger logger = LoggerFactory.getLogger(WeavingSimulatorListener.class);

    private final WeavingSimulatorService weavingSimulatorService;
    private final SensorDataRepository sensorDataRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${weaving.simulation.auto-advance:false}")
    private boolean autoAdvance;

    public WeavingSimulatorListener(WeavingSimulatorService weavingSimulatorService,
                                    SensorDataRepository sensorDataRepository,
                                    ObjectMapper objectMapper,
                                    ApplicationEventPublisher eventPublisher) {
        this.weavingSimulatorService = weavingSimulatorService;
        this.sensorDataRepository = sensorDataRepository;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    @EventListener
    public void onSensorDataReceived(SensorDataReceivedEvent event) {
        SensorDataDTO dto = event.getSensorData();

        if (dto.getShedOpeningArray() != null && dto.getShedOpeningArray().length > 0) {
            double baseTension = dto.getWarpTension() != null ? dto.getWarpTension() : 2.2;
            double[] frictionTensions = weavingSimulatorService.computeWarpTensionWithFriction(
                    dto.getLoomId(), baseTension, dto.getShedOpeningArray());

            List<SensorData> latest = sensorDataRepository.findTopNByLoomId(dto.getLoomId(), 1);
            if (!latest.isEmpty()) {
                SensorData latestData = latest.get(0);
                try {
                    latestData.setWarpTensionArray(objectMapper.writeValueAsString(frictionTensions));
                    sensorDataRepository.save(latestData);
                    logger.info("异步补充计算摩擦修正张力完成, loomId={}, warpCount={}", dto.getLoomId(), frictionTensions.length);
                } catch (JsonProcessingException e) {
                    logger.error("序列化摩擦修正张力失败, loomId={}: {}", dto.getLoomId(), e.getMessage());
                }
            }

            if (autoAdvance && dto.getLoomId() != null) {
                try {
                    weavingSimulatorService.processWeftInsertion(dto.getLoomId(), dto.getShedOpeningArray());
                    logger.info("自动推进仿真完成, loomId={}", dto.getLoomId());
                } catch (Exception e) {
                    logger.warn("自动推进仿真失败, loomId={}: {}", dto.getLoomId(), e.getMessage());
                }
            } else {
                int weftRow = dto.getPatternPosition() != null ? dto.getPatternPosition() : 0;
                eventPublisher.publishEvent(new SimulationStepEvent(this, dto.getLoomId(), weftRow, dto.getShedOpeningArray()));
                logger.debug("发布SimulationStepEvent更新3D场景, loomId={}", dto.getLoomId());
            }
        }
    }
}
