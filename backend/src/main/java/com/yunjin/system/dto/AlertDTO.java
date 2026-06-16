package com.yunjin.system.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AlertDTO {
    private Long id;
    private Long loomId;
    private String loomCode;
    private String alertType;
    private String alertLevel;
    private String message;
    private Boolean resolved;
    private LocalDateTime createdAt;
}
