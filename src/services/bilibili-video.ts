/**
 * B站视频分析服务
 * 提供视频信息获取、字幕提取和内容分析功能
 */

// B站视频信息接口
export interface BilibiliVideoInfo {
    bvid: string;
    aid: number;
    title: string;
    desc: string;
    duration: number;
    owner: {
        name: string;
        mid: number;
    };
    stat: {
        view: number;
        danmaku: number;
        reply: number;
        favorite: number;
        coin: number;
        share: number;
        like: number;
    };
    pages: Array<{
        cid: number;
        page: number;
        part: string;
        duration: number;
    }>;
}

// 字幕信息接口
export interface SubtitleInfo {
    startTime: number;
    endTime: number;
    text: string;
}

// 视频分析结果接口
export interface VideoAnalysisResult {
    title: string;
    duration: string;
    summary: string;
    chapters: Array<{
        title: string;
        startTime: number;
        endTime: number;
        summary: string;
        jumpUrl: string;
    }>;
    highlights: Array<{
        content: string;
        timestamp: number;
        jumpUrl: string;
    }>;
    originalUrl: string;
}

/**
 * B站视频分析服务类
 */
export class BilibiliVideoService {
    
    /**
     * 从B站URL提取视频ID
     */
    static extractVideoId(url: string): { bvid?: string; aid?: string } | null {
        try {
            // 支持多种B站URL格式
            // https://www.bilibili.com/video/BV1xx411c7mD
            // https://b23.tv/BV1xx411c7mD
            // https://www.bilibili.com/video/av123456
            
            const bvidMatch = url.match(/(?:BV|bv)([a-zA-Z0-9]+)/);
            if (bvidMatch) {
                return { bvid: 'BV' + bvidMatch[1] };
            }
            
            const aidMatch = url.match(/(?:av|AV)(\d+)/);
            if (aidMatch) {
                return { aid: aidMatch[1] };
            }
            
            return null;
        } catch (error) {
            console.error('[BilibiliVideoService] URL解析失败:', error);
            return null;
        }
    }

    /**
     * 获取B站视频信息
     */
    static async getVideoInfo(videoId: { bvid?: string; aid?: string }): Promise<BilibiliVideoInfo | null> {
        try {
            let apiUrl = 'https://api.bilibili.com/x/web-interface/view?';
            
            if (videoId.bvid) {
                apiUrl += `bvid=${videoId.bvid}`;
            } else if (videoId.aid) {
                apiUrl += `aid=${videoId.aid}`;
            } else {
                throw new Error('无效的视频ID');
            }

            console.log('[BilibiliVideoService] 获取视频信息:', apiUrl);
            
            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://www.bilibili.com/'
                }
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.code !== 0) {
                throw new Error(`B站API错误: ${data.message || '未知错误'}`);
            }

            return data.data as BilibiliVideoInfo;
        } catch (error) {
            console.error('[BilibiliVideoService] 获取视频信息失败:', error);
            return null;
        }
    }

    /**
     * 获取视频字幕
     */
    static async getSubtitles(cid: number): Promise<SubtitleInfo[]> {
        try {
            // 首先获取字幕列表
            const subtitleListUrl = `https://api.bilibili.com/x/player/v2?cid=${cid}`;
            
            console.log('[BilibiliVideoService] 获取字幕列表:', subtitleListUrl);
            
            const listResponse = await fetch(subtitleListUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://www.bilibili.com/'
                }
            });

            if (!listResponse.ok) {
                throw new Error(`字幕列表请求失败: ${listResponse.status}`);
            }

            const listData = await listResponse.json();
            
            if (listData.code !== 0) {
                console.log('[BilibiliVideoService] 无字幕信息或字幕获取失败:', listData.message);
                return [];
            }

            // 检查是否有字幕
            const subtitles = listData.data?.subtitle?.subtitles;
            if (!subtitles || subtitles.length === 0) {
                console.log('[BilibiliVideoService] 该视频没有字幕');
                return [];
            }

            // 获取第一个字幕文件（通常是中文）
            const firstSubtitle = subtitles[0];
            const subtitleUrl = firstSubtitle.subtitle_url;
            
            if (!subtitleUrl) {
                console.log('[BilibiliVideoService] 字幕URL为空');
                return [];
            }

            // 获取字幕内容
            const subtitleResponse = await fetch(subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`);
            
            if (!subtitleResponse.ok) {
                throw new Error(`字幕内容请求失败: ${subtitleResponse.status}`);
            }

            const subtitleData = await subtitleResponse.json();
            
            // 解析字幕数据
            const subtitleItems: SubtitleInfo[] = [];
            
            if (subtitleData.body && Array.isArray(subtitleData.body)) {
                for (const item of subtitleData.body) {
                    subtitleItems.push({
                        startTime: item.from || 0,
                        endTime: item.to || 0,
                        text: item.content || ''
                    });
                }
            }

            console.log(`[BilibiliVideoService] 成功获取字幕，共 ${subtitleItems.length} 条`);
            return subtitleItems;
            
        } catch (error) {
            console.error('[BilibiliVideoService] 获取字幕失败:', error);
            return [];
        }
    }

    /**
     * 格式化时间（秒转为 mm:ss 格式）
     */
    static formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * 生成跳转URL
     */
    static generateJumpUrl(originalUrl: string, timestamp: number): string {
        try {
            const url = new URL(originalUrl);
            url.searchParams.set('t', Math.floor(timestamp).toString());
            return url.toString();
        } catch (error) {
            console.error('[BilibiliVideoService] 生成跳转URL失败:', error);
            return originalUrl;
        }
    }

    /**
     * 分析视频内容（使用AI）
     */
    static async analyzeVideoContent(
        videoInfo: BilibiliVideoInfo, 
        subtitles: SubtitleInfo[], 
        analysisType: string = 'summary',
        focusKeywords?: string
    ): Promise<string> {
        try {
            // 构建分析提示词
            let prompt = `请分析以下B站视频内容：

视频标题：${videoInfo.title}
视频描述：${videoInfo.desc}
视频时长：${this.formatTime(videoInfo.duration)}
UP主：${videoInfo.owner.name}

`;

            if (subtitles.length > 0) {
                prompt += `字幕内容：\n`;
                subtitles.forEach((subtitle) => {
                    prompt += `[${this.formatTime(subtitle.startTime)}] ${subtitle.text}\n`;
                });
            } else {
                prompt += `注意：该视频没有字幕，请基于标题和描述进行分析。\n`;
            }

            // 根据分析类型调整提示词
            switch (analysisType) {
                case 'summary':
                    prompt += `\n请提供视频的简要总结，包括主要内容和关键要点。`;
                    break;
                case 'chapters':
                    prompt += `\n请将视频内容分成几个主要章节，每个章节包含标题、时间范围和内容摘要。`;
                    break;
                case 'highlights':
                    prompt += `\n请提取视频中的重点内容和亮点时刻，标注具体时间戳。`;
                    break;
                case 'full':
                    prompt += `\n请提供完整的视频分析，包括内容摘要、章节划分、重点时刻和学习建议。`;
                    break;
            }

            if (focusKeywords) {
                prompt += `\n特别关注以下关键词相关的内容：${focusKeywords}`;
            }

            prompt += `\n\n请以结构化的格式输出分析结果，包含时间戳和跳转链接。`;

            return prompt;
        } catch (error) {
            console.error('[BilibiliVideoService] 构建分析提示词失败:', error);
            return '视频分析失败，请稍后重试。';
        }
    }
} 