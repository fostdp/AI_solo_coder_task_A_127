package com.yunjin.system;

import com.yunjin.system.config.ImageProcessingProperties;
import com.yunjin.system.config.WeavingProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({WeavingProperties.class, ImageProcessingProperties.class})
public class YunjinWeavingApplication {
    public static void main(String[] args) {
        SpringApplication.run(YunjinWeavingApplication.class, args);
        System.out.println("========================================");
        System.out.println("  古代云锦织机提花工艺仿真系统启动成功!");
        System.out.println("  访问地址: http://localhost:8080");
        System.out.println("========================================");
    }
}
