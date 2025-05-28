/**
 * B站视频分析服务
 * 提供视频信息获取、字幕提取和内容分析功能
 */

// B站视频信息接口
export interface BilibiliVideoInfo {
    bvid: string;
    aid: number;
    videos: number; // 稿件分P总数
    tid: number; // 分区tid
    tname: string; // 子分区名称
    copyright: number; // 视频类型 1：原创 2：转载
    pic: string; // 稿件封面图片url
    title: string;
    pubdate: number; // 稿件发布时间 秒级时间戳
    ctime: number; // 用户投稿时间 秒级时间戳
    desc: string;
    desc_v2?: Array<{ // 新版视频简介
        raw_text: string;
        type: number;
        biz_id: number;
    }> | null;
    state: number; // 视频状态
    duration: number; // 稿件总时长(所有分P) 单位为秒
    mission_id?: number; // 稿件参与的活动id
    redirect_url?: string; // 重定向url (仅番剧或影视)
    rights: { // 视频属性标志
        bp: number;
        elec: number;
        download: number;
        movie: number;
        pay: number;
        hd5: number;
        no_reprint: number;
        autoplay: number;
        ugc_pay: number;
        is_cooperation: number;
        ugc_pay_preview: number;
        no_background: number;
        clean_mode: number;
        is_stein_gate: number;
        is_360: number;
        no_share: number;
        arc_pay: number;
        free_watch: number;
    };
    owner: {
        mid: number;
        name: string;
        face: string; // UP主头像
    };
    stat: {
        aid: number; // avid
        view: number;
        danmaku: number;
        reply: number;
        favorite: number;
        coin: number;
        share: number;
        now_rank: number; // 当前排名
        his_rank: number; // 历史最高排行
        like: number;
        dislike: number; // 点踩数 (恒为0)
        evaluation: string; // 视频评分
        vt?: number; // 作用尚不明确 (恒为0)
    };
    dynamic?: string; // 视频同步发布的的动态的文字内容
    cid: number; // 视频1P cid
    dimension?: { // 视频1P分辨率
        width: number;
        height: number;
        rotate: number;
    } | null;
    premiere?: any | null; // 通常为null
    teenage_mode?: number;
    is_chargeable_season?: boolean;
    is_story?: boolean;
    is_upower_exclusive?: boolean;
    is_upower_play?: boolean;
    is_upower_preview?: boolean;
    no_cache?: boolean;
    pages: Array<{
        cid: number;
        page: number;
        from: string; // 视频来源
        part: string;
        duration: number;
        vid?: string; // 站外视频vid
        weblink?: string; // 站外视频跳转url
        dimension: { // 当前分P分辨率
            width: number;
            height: number;
            rotate: number;
        };
    }>;
    subtitle?: { // 视频CC字幕信息
        allow_submit: boolean;
        list: Array<{
            id: number;
            lan: string;
            lan_doc: string;
            is_lock: boolean;
            author_mid: number;
            subtitle_url: string;
            author: {
                mid: number;
                name: string;
                sex: string;
                face: string;
                sign: string;
                rank: number;
                birthday: number;
                is_fake_account: number;
                is_deleted: number;
            };
        }> | null;
    } | null;
    staff?: Array<{ // 合作成员列表
        mid: number;
        title: string;
        name: string;
        face: string;
        vip: {
            type: number;
            status: number;
            due_date: number;
            vip_pay_type: number;
            theme_type: number;
        };
        official: {
            role: number;
            title: string;
            desc: string;
            type: number;
        };
        follower: number;
        label_style: number;
    }> | null;
    is_season_display?: boolean;
    user_garb?: { // 用户装扮信息
        url_image_ani_cut: string;
    } | null;
    honor_reply?: {
      honor?: Array<{
        aid?: number;
        type?: number;
        desc?: string;
        weekly_recommend_num?: number;
      }> | null;
    } | null;
    like_icon?: string;
    need_jump_bv?: boolean;
    disable_show_up_info?: boolean;
    is_story_play?: boolean | number; // 文档中为 is_story_play: 1, 但通常bool
    is_view_self?: boolean;
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
            
            console.log('[BilibiliVideoService] 正在解析URL:', url);
            
            // 修复BV号提取正则表达式，确保提取完整的BV号（BV + 10位字母数字）
            const bvidMatch = url.match(/BV([a-zA-Z0-9]{10})/i);
            if (bvidMatch) {
                const fullBvid = 'BV' + bvidMatch[1];
                console.log('[BilibiliVideoService] 提取到BV号:', fullBvid);
                return { bvid: fullBvid };
            }
            
            // 提取AV号
            const aidMatch = url.match(/av(\d+)/i);
            if (aidMatch) {
                const aid = aidMatch[1];
                console.log('[BilibiliVideoService] 提取到AV号:', aid);
                return { aid: aid };
            }
            
            console.log('[BilibiliVideoService] 无法从URL中提取视频ID');
            return null;
        } catch (error) {
            console.error('[BilibiliVideoService] URL解析失败:', error);
            return null;
        }
    }

    /**
     * 快速获取视频封面信息
     */
    static async getVideoThumbnail(videoId: { bvid?: string; aid?: string }): Promise<{ title: string; pic: string; bvid: string } | null> {
        try {
            let apiUrl = 'https://api.bilibili.com/x/web-interface/view?';
            
            if (videoId.bvid) {
                apiUrl += `bvid=${videoId.bvid}`;
            } else if (videoId.aid) {
                apiUrl += `aid=${videoId.aid}`;
            } else {
                throw new Error('无效的视频ID');
            }

            console.log('[BilibiliVideoService] 获取视频封面:', apiUrl);
            
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

            const videoData = data.data;
            return {
                title: videoData.title,
                pic: videoData.pic,
                bvid: videoData.bvid
            };
        } catch (error) {
            console.error('[BilibiliVideoService] 获取视频封面失败:', error);
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
        focusKeywords?: string,
        originalUrl?: string
    ): Promise<string> {
        try {
            // 构建基础视频URL（如果没有提供originalUrl，则根据bvid构建）
            const baseVideoUrl = originalUrl || `https://www.bilibili.com/video/${videoInfo.bvid}`;
            
            // 构建分析提示词
            let prompt = `请分析以下B站视频内容：

视频标题：${videoInfo.title}
视频描述：${videoInfo.desc}
视频时长：${this.formatTime(videoInfo.duration)}
UP主：${videoInfo.owner.name}
视频链接：${baseVideoUrl}

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

            prompt += `\n\n请以结构化的格式输出分析结果。如果需要生成跳转链接，请使用以下格式：
- 对于时间戳跳转，使用：${baseVideoUrl}?t=秒数
- 例如：${baseVideoUrl}?t=225 表示跳转到3分45秒

重要：请确保所有跳转链接都使用上述提供的视频链接 ${baseVideoUrl}，不要使用其他URL。`;

            return prompt;
        } catch (error) {
            console.error('[BilibiliVideoService] 构建分析提示词失败:', error);
            return '视频分析失败，请稍后重试。';
        }
    }
} 