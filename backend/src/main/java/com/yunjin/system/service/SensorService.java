package com.yunjin.system.service;

import com.yunjin.system.dto.SensorDataDTO;
import com.yunjin.system.entity.SensorData;
import com.yunjin.system.repository.SensorDataRepository;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SensorService {

    private final SensorDataRepository sensorDataRepository;
    private final ObjectMapper objectMapper;
    private final WeavingSimulationService weavingSimulationService;

    public SensorService(SensorDataRepository sensorDataRepository,
                         ObjectMapper objectMapper,
                         WeavingSimulationService weavingSimulationService) {
        this.sensorDataRepository = sensorDataRepository;
        this.objectMapper = objectMapper;
        this.weavingSimulationService = weavingSimulationService;
    }

    public SensorData save(SensorDataDTO dto) {
        SensorData data = new SensorData();
        data.setLoomId(dto.getLoomId());
        data.setWarpTension(dto.getWarpTension());
        data.setWeftDensity(dto.getWeftDensity());
        data.setPatternPosition(dto.getPatternPosition());
        data.setFabricProgress(dto.getFabricProgress());
        data.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());

        try {
            double[] tensionArr = dto.getWarpTensionArray();
            int[] shedArr = dto.getShedOpeningArray();

            if (tensionArr == null && dto.getWarpTension() != null && shedArr != null && shedArr.length > 0) {
                tensionArr = weavingSimulationService.computeWarpTensionWithFriction(
                        dto.getLoomId(), dto.getWarpTension(), shedArr);
            } else if (tensionArr != null && shedArr != null && dto.getWarpTension() != null) {
                double[] frictionCorrected = weavingSimulationService.computeWarpTensionWithFriction(
                        dto.getLoomId(), dto.getWarpTension(), shedArr);
                int len = Math.min(tensionArr.length, frictionCorrected.length);
                for (int i = 0; i < len; i++) {
                    if (tensionArr[i] > 0.1) {
                        double blendRatio = 0.65;
                        tensionArr[i] = blendRatio * frictionCorrected[i]
                                + (1.0 - blendRatio) * tensionArr[i];
                    }
                }
            }

            if (tensionArr != null) {
                data.setWarpTensionArray(objectMapper.writeValueAsString(tensionArr));
            } else if (dto.getWarpTensionArray() != null) {
                data.setWarpTensionArray(objectMapper.writeValueAsString(dto.getWarpTensionArray()));
            }

            if (shedArr != null) {
                data.setShedOpeningArray(objectMapper.writeValueAsString(shedArr));
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化数组数据失败", e);
        }

        return sensorDataRepository.save(data);
    }

    public List<SensorData> getLatestByLoomId(Long loomId, int limit) {
        return sensorDataRepository.findTopNByLoomId(loomId, Math.max(1, Math.min(limit, 1000)));
    }

    public Optional<SensorData> getLatestSingleByLoomId(Long loomId) {
        List<SensorData> list = sensorDataRepository.findTopNByLoomId(loomId, 1);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<SensorData> getByLoomIdAndTimeRange(Long loomId, LocalDateTime start, LocalDateTime end) {
        return sensorDataRepository.findByLoomIdAndTimestampBetweenOrderByTimestamp(loomId, start, end);
    }
}
