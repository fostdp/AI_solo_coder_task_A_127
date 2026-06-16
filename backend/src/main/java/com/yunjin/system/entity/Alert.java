package com.yunjin.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "alert", indexes = {
    @Index(name = "idx_alert_loom_id", columnList = "loom_id"),
    @Index(name = "idx_alert_resolved", columnList = "resolved")
})
public class Alert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loom_id", nullable = false)
    private Long loomId;

    @Column(name = "alert_type", nullable = false, length = 50)
    private String alertType;

    @Column(name = "alert_level", length = 20)
    private String alertLevel = "WARNING";

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false)
    private Boolean resolved = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}
