package com.yunjin.system.dtu_receiver;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunjin.system.dto.SensorDataDTO;
import com.yunjin.system.entity.SensorData;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sensor")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SensorDataController {

    private final DtuReceiverService dtuReceiverService;
    private final ObjectMapper objectMapper;

    public SensorDataController(DtuReceiverService dtuReceiverService,
                                ObjectMapper objectMapper) {
        this.dtuReceiverService = dtuReceiverService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/ingest")
    public ResponseEntity<Map<String, Object>> ingest(@RequestBody SensorDataDTO dto) {
        try {
            SensorData saved = dtuReceiverService.ingest(dto);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", saved);
            result.put("message", "传感器数据接收成功");
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Map<String, Object> bad = new HashMap<>();
            bad.put("success", false);
            bad.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(bad);
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", "处理传感器数据失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    @GetMapping("/loom/{loomId}")
    public ResponseEntity<Map<String, Object>> getLatest(@PathVariable Long loomId,
                                                         @RequestParam(defaultValue = "100") int limit) {
        try {
            List<SensorData> list = dtuReceiverService.getLatestByLoomId(loomId, limit);
            List<SensorDataDTO> dtoList = new ArrayList<>();
            for (SensorData sd : list) {
                dtoList.add(convertEntityToDto(sd));
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", dtoList);
            result.put("total", dtoList.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    @GetMapping("/loom/{loomId}/range")
    public ResponseEntity<Map<String, Object>> getByRange(
            @PathVariable Long loomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        try {
            List<SensorData> list = dtuReceiverService.getByLoomIdAndTimeRange(loomId, start, end);
            List<SensorDataDTO> dtoList = new ArrayList<>();
            for (SensorData sd : list) {
                dtoList.add(convertEntityToDto(sd));
            }
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", dtoList);
            result.put("total", dtoList.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    private SensorDataDTO convertEntityToDto(SensorData entity) {
        SensorDataDTO dto = new SensorDataDTO();
        dto.setLoomId(entity.getLoomId());
        dto.setWarpTension(entity.getWarpTension());
        dto.setWeftDensity(entity.getWeftDensity());
        dto.setPatternPosition(entity.getPatternPosition());
        dto.setFabricProgress(entity.getFabricProgress());
        dto.setTimestamp(entity.getTimestamp());

        try {
            if (entity.getWarpTensionArray() != null && !entity.getWarpTensionArray().isEmpty()) {
                double[] arr = objectMapper.readValue(entity.getWarpTensionArray(),
                        new TypeReference<double[]>() {});
                dto.setWarpTensionArray(arr);
            }
            if (entity.getShedOpeningArray() != null && !entity.getShedOpeningArray().isEmpty()) {
                int[] arr = objectMapper.readValue(entity.getShedOpeningArray(),
                        new TypeReference<int[]>() {});
                dto.setShedOpeningArray(arr);
            }
        } catch (JsonProcessingException e) {
            // ignore
        }
        return dto;
    }
}
