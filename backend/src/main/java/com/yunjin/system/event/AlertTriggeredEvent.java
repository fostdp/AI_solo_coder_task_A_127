package com.yunjin.system.event;

import org.springframework.context.ApplicationEvent;
import com.yunjin.system.dto.AlertDTO;

public class AlertTriggeredEvent extends ApplicationEvent {
    private final AlertDTO alert;

    public AlertTriggeredEvent(Object source, AlertDTO alert) {
        super(source);
        this.alert = alert;
    }

    public AlertDTO getAlert() { return alert; }
}
