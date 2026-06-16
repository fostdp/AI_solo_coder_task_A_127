package com.yunjin.system.controller;

import com.yunjin.system.dto.AlertDTO;
import com.yunjin.system.entity.Alert;
import com.yunjin.system.service.AlertService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/active")
    public ResponseEntity<Map<String, Object>> getActiveAlerts() {
        try {
            List<AlertDTO> alerts = alertService.getActiveAlerts();
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", alerts);
            result.put("count", alerts.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取活跃告警失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/loom/{loomId}")
    public ResponseEntity<Map<String, Object>> getAlertsByLoom(@PathVariable Long loomId) {
        try {
            List<AlertDTO> alerts = alertService.getByLoomId(loomId);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", alerts);
            result.put("count", alerts.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取织机告警失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PutMapping("/resolve/{alertId}")
    public ResponseEntity<Map<String, Object>> resolveAlert(@PathVariable Long alertId) {
        try {
            Alert alert = alertService.resolveAlert(alertId);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", alert);
            result.put("message", "告警已解决");
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Map<String, Object> notFound = new HashMap<>();
            notFound.put("success", false);
            notFound.put("message", "告警不存在: " + alertId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "解决告警失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
