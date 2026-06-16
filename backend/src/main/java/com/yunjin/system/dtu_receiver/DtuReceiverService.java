package com.yunjin.system.dtu_receiver;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunjin.system.dto.SensorDataDTO;
import com.yunjin.system.entity.SensorData;
import com.yunjin.system.event.SensorDataReceivedEvent;
import com.yunjin.system.repository.SensorDataRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class DtuReceiverService {

    private final SensorDataRepository sensorDataRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public DtuReceiverService(SensorDataRepository sensorDataRepository,
                              ObjectMapper objectMapper,
                              ApplicationEventPublisher eventPublisher) {
        this.sensorDataRepository = sensorDataRepository;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    public void validate(SensorDataDTO dto) {
        if (dto.getLoomId() == null) {
            throw new IllegalArgumentException("loomId不能为空");
        }
        if (dto.getWarpTension() != null && (dto.getWarpTension() < 0 || dto.getWarpTension() > 10)) {
            throw new IllegalArgumentException("warpTension范围应在[0,10]之间");
        }
        if (dto.getWeftDensity() != null && (dto.getWeftDensity() < 0 || dto.getWeftDensity() > 200)) {
            throw new IllegalArgumentException("weftDensity范围应在[0,200]之间");
        }
        if (dto.getPatternPosition() != null && dto.getPatternPosition() < 0) {
            throw new IllegalArgumentException("patternPosition不能为负数");
        }
        if (dto.getFabricProgress() != null && (dto.getFabricProgress() < 0 || dto.getFabricProgress() > 1)) {
            throw new IllegalArgumentException("fabricProgress范围应在[0,1]之间");
        }
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
            if (dto.getWarpTensionArray() != null) {
                data.setWarpTensionArray(objectMapper.writeValueAsString(dto.getWarpTensionArray()));
            }
            if (dto.getShedOpeningArray() != null) {
                data.setShedOpeningArray(objectMapper.writeValueAsString(dto.getShedOpeningArray()));
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化数组数据失败", e);
        }

        return sensorDataRepository.save(data);
    }

    public SensorData ingest(SensorDataDTO dto) {
        validate(dto);
        SensorData saved = save(dto);
        eventPublisher.publishEvent(new SensorDataReceivedEvent(this, dto));
        return saved;
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
