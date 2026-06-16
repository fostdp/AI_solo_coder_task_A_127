package com.yunjin.system.alarm_ws;

import com.yunjin.system.config.WeavingProperties;
import com.yunjin.system.dto.AlertDTO;
import com.yunjin.system.dto.SensorDataDTO;
import com.yunjin.system.entity.Alert;
import com.yunjin.system.entity.Loom;
import com.yunjin.system.repository.AlertRepository;
import com.yunjin.system.repository.LoomRepository;
import com.yunjin.system.repository.SensorDataRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlarmEvaluationService {

    private final AlertRepository alertRepository;
    private final SensorDataRepository sensorDataRepository;
    private final LoomRepository loomRepository;
    private final WeavingProperties weavingProperties;

    private final Map<Long, List<Integer>> loomPatternHistory = new ConcurrentHashMap<>();

    public AlarmEvaluationService(AlertRepository alertRepository,
                                  SensorDataRepository sensorDataRepository,
                                  LoomRepository loomRepository,
                                  WeavingProperties weavingProperties) {
        this.alertRepository = alertRepository;
        this.sensorDataRepository = sensorDataRepository;
        this.loomRepository = loomRepository;
        this.weavingProperties = weavingProperties;
    }

    public List<Alert> checkAndGenerateAlerts(SensorDataDTO dto) {
        List<Alert> generatedAlerts = new ArrayList<>();

        Long loomId = dto.getLoomId();
        if (loomId == null) {
            return generatedAlerts;
        }

        Optional<Loom> loomOpt = loomRepository.findById(loomId);
        Loom loom = loomOpt.orElse(null);

        Alert warpBreakAlert = checkWarpBreakage(loomId, dto);
        if (warpBreakAlert != null) {
            generatedAlerts.add(alertRepository.save(warpBreakAlert));
        }

        Alert tensionAlert = checkTensionAnomaly(loomId, dto);
        if (tensionAlert != null) {
            generatedAlerts.add(alertRepository.save(tensionAlert));
        }

        Alert patternAlert = checkPatternMisalignment(loomId, dto);
        if (patternAlert != null) {
            generatedAlerts.add(alertRepository.save(patternAlert));
        }

        Alert densityAlert = checkWeftDensityError(loomId, dto, loom);
        if (densityAlert != null) {
            generatedAlerts.add(alertRepository.save(densityAlert));
        }

        return generatedAlerts;
    }

    public List<AlertDTO> getActiveAlerts() {
        List<Alert> activeAlerts = alertRepository.findByResolvedFalseOrderByCreatedAtDesc();
        return convertToDTOList(activeAlerts);
    }

    public List<AlertDTO> getByLoomId(Long loomId) {
        List<Alert> alerts = alertRepository.findByLoomIdOrderByCreatedAtDesc(loomId);
        return convertToDTOList(alerts);
    }

    public Alert resolveAlert(Long alertId) {
        Optional<Alert> alertOpt = alertRepository.findById(alertId);
        if (alertOpt.isEmpty()) {
            throw new IllegalArgumentException("Alert not found with id: " + alertId);
        }

        Alert alert = alertOpt.get();
        alert.setResolved(true);
        alert.setResolvedAt(LocalDateTime.now());
        return alertRepository.save(alert);
    }

    private Alert checkWarpBreakage(Long loomId, SensorDataDTO dto) {
        double[] tensionArray = dto.getWarpTensionArray();
        if (tensionArray == null || tensionArray.length == 0) {
            return null;
        }

        double warpBreakEpsilon = weavingProperties.getAlert().getWarpBreakEpsilon();

        List<Integer> brokenWarpIndices = new ArrayList<>();
        for (int i = 0; i < tensionArray.length; i++) {
            if (tensionArray[i] < warpBreakEpsilon) {
                brokenWarpIndices.add(i);
            }
        }

        if (brokenWarpIndices.isEmpty()) {
            return null;
        }

        String message = String.format(
                "经纱断头检测：检测到 %d 根经纱张力接近0，位置: %s",
                brokenWarpIndices.size(),
                formatBrokenIndices(brokenWarpIndices, tensionArray.length)
        );

        Alert alert = new Alert();
        alert.setLoomId(loomId);
        alert.setAlertType("WARP_BREAKAGE");
        alert.setAlertLevel("CRITICAL");
        alert.setMessage(message);
        alert.setResolved(false);
        alert.setCreatedAt(LocalDateTime.now());

        return alert;
    }

    private Alert checkTensionAnomaly(Long loomId, SensorDataDTO dto) {
        double[] tensionArray = dto.getWarpTensionArray();
        Double warpTension = dto.getWarpTension();
        double warpBreakEpsilon = weavingProperties.getAlert().getWarpBreakEpsilon();
        double tensionMin = weavingProperties.getAlert().getWarpTensionMin();
        double tensionMax = weavingProperties.getAlert().getWarpTensionMax();

        double avgTension;
        if (tensionArray != null && tensionArray.length > 0) {
            double sum = 0.0;
            int count = 0;
            for (double t : tensionArray) {
                if (t > warpBreakEpsilon) {
                    sum += t;
                    count++;
                }
            }
            avgTension = count > 0 ? sum / count : 0.0;
        } else if (warpTension != null) {
            avgTension = warpTension;
        } else {
            return null;
        }

        boolean anomaly = false;
        String reason = "";
        if (avgTension < tensionMin && avgTension > warpBreakEpsilon) {
            anomaly = true;
            reason = String.format("整体张力 %.3f 低于最小值 %.3f", avgTension, tensionMin);
        } else if (avgTension > tensionMax) {
            anomaly = true;
            reason = String.format("整体张力 %.3f 超过最大值 %.3f", avgTension, tensionMax);
        }

        if (!anomaly) {
            return null;
        }

        Alert alert = new Alert();
        alert.setLoomId(loomId);
        alert.setAlertType("TENSION_ANOMALY");
        alert.setAlertLevel("WARNING");
        alert.setMessage("经纱张力异常：" + reason);
        alert.setResolved(false);
        alert.setCreatedAt(LocalDateTime.now());

        return alert;
    }

    private Alert checkPatternMisalignment(Long loomId, SensorDataDTO dto) {
        Integer patternPos = dto.getPatternPosition();
        if (patternPos == null) {
            return null;
        }

        int misalignThreshold = weavingProperties.getAlert().getPatternMisalignmentThreshold();
        int jumpWindow = weavingProperties.getAlert().getPatternJumpWindow();

        List<Integer> history = loomPatternHistory.computeIfAbsent(loomId, k -> new ArrayList<>());

        if (!history.isEmpty()) {
            int lastPos = history.get(history.size() - 1);
            int diff = Math.abs(patternPos - lastPos);
            if (diff > misalignThreshold && diff < 1000) {
                if (checkConsecutiveJumps(history, patternPos, misalignThreshold, jumpWindow)) {
                    String message = String.format(
                            "花本错位检测：最近 %d 次 patternPosition 跳跃差均超过阈值 %d，当前位置: %d",
                            jumpWindow, misalignThreshold, patternPos
                    );

                    Alert alert = new Alert();
                    alert.setLoomId(loomId);
                    alert.setAlertType("PATTERN_MISALIGNMENT");
                    alert.setAlertLevel("CRITICAL");
                    alert.setMessage(message);
                    alert.setResolved(false);
                    alert.setCreatedAt(LocalDateTime.now());

                    history.clear();
                    history.add(patternPos);
                    return alert;
                }
            }
        }

        history.add(patternPos);
        if (history.size() > jumpWindow * 2) {
            history.subList(0, history.size() - jumpWindow * 2).clear();
        }

        return null;
    }

    private boolean checkConsecutiveJumps(List<Integer> history, int currentPos,
                                          int misalignThreshold, int jumpWindow) {
        if (history.size() < jumpWindow - 1) {
            return false;
        }

        int consecutiveCount = 0;
        int lastPos = currentPos;

        for (int i = history.size() - 1; i >= 0 && consecutiveCount < jumpWindow - 1; i--) {
            int diff = Math.abs(lastPos - history.get(i));
            if (diff > misalignThreshold && diff < 1000) {
                consecutiveCount++;
                lastPos = history.get(i);
            } else {
                break;
            }
        }

        return consecutiveCount >= jumpWindow - 1;
    }

    private Alert checkWeftDensityError(Long loomId, SensorDataDTO dto, Loom loom) {
        Double weftDensity = dto.getWeftDensity();
        if (weftDensity == null || weftDensity <= 0) {
            return null;
        }

        double targetDensity;
        if (loom != null && loom.getWeftDensityTarget() != null) {
            targetDensity = loom.getWeftDensityTarget();
        } else {
            targetDensity = weavingProperties.getSimulation().getDefaultWeftDensity();
        }

        double deviation = Math.abs(weftDensity - targetDensity) / targetDensity;
        double tolerance = weavingProperties.getAlert().getWeftDensityTolerance();

        if (deviation <= tolerance) {
            return null;
        }

        String message = String.format(
                "纬密偏差：当前纬密 %.2f，目标纬密 %.2f，偏差 %.1f%% 超过容许 %.0f%%",
                weftDensity, targetDensity, deviation * 100, tolerance * 100
        );

        Alert alert = new Alert();
        alert.setLoomId(loomId);
        alert.setAlertType("WEFT_DENSITY_ERROR");
        alert.setAlertLevel("WARNING");
        alert.setMessage(message);
        alert.setResolved(false);
        alert.setCreatedAt(LocalDateTime.now());

        return alert;
    }

    private String formatBrokenIndices(List<Integer> indices, int total) {
        if (indices.isEmpty()) {
            return "无";
        }
        if (indices.size() <= 10) {
            return indices.toString();
        }
        StringBuilder sb = new StringBuilder();
        sb.append(indices.subList(0, 5).toString());
        sb.append(" ... ");
        sb.append(indices.subList(indices.size() - 5, indices.size()).toString());
        sb.append(String.format(" (共 %d / %d)", indices.size(), total));
        return sb.toString();
    }

    private List<AlertDTO> convertToDTOList(List<Alert> alerts) {
        List<AlertDTO> dtoList = new ArrayList<>();
        Map<Long, String> loomCodeCache = new HashMap<>();

        for (Alert alert : alerts) {
            AlertDTO dto = new AlertDTO();
            dto.setId(alert.getId());
            dto.setLoomId(alert.getLoomId());
            dto.setAlertType(alert.getAlertType());
            dto.setAlertLevel(alert.getAlertLevel());
            dto.setMessage(alert.getMessage());
            dto.setResolved(alert.getResolved());
            dto.setCreatedAt(alert.getCreatedAt());

            String loomCode = loomCodeCache.get(alert.getLoomId());
            if (loomCode == null) {
                Optional<Loom> loomOpt = loomRepository.findById(alert.getLoomId());
                if (loomOpt.isPresent()) {
                    loomCode = loomOpt.get().getLoomCode();
                } else {
                    loomCode = "";
                }
                loomCodeCache.put(alert.getLoomId(), loomCode);
            }
            dto.setLoomCode(loomCode);

            dtoList.add(dto);
        }

        return dtoList;
    }
}
