package com.yunjin.system.event;

import org.springframework.context.ApplicationEvent;
import com.yunjin.system.dto.SensorDataDTO;

public class SensorDataReceivedEvent extends ApplicationEvent {
    private final SensorDataDTO sensorData;

    public SensorDataReceivedEvent(Object source, SensorDataDTO sensorData) {
        super(source);
        this.sensorData = sensorData;
    }

    public SensorDataDTO getSensorData() { return sensorData; }
}
