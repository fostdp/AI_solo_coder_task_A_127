package com.yunjin.system.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "image-processing")
@Data
public class ImageProcessingProperties {
    private Fft fft = new Fft();
    private Wavelet wavelet = new Wavelet();
    private Texture texture = new Texture();

    @Data
    public static class Fft {
        private int maxSize = 512;
        private String normalization = "STANDARD";
    }

    @Data
    public static class Wavelet {
        private String type = "HAAR";
        private int levels = 4;
        private double edgeThresholdSigma = 2.0;
    }

    @Data
    public static class Texture {
        private int displaySize = 256;
        private int warpColor = 0xE8D4A8;
        private int weftColor = 9130195;
        private double lightAngle = 45.0;
    }
}
