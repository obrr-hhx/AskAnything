#!/bin/bash

# 构建项目
echo "🔨 构建项目..."
npm run build

# 检查构建是否成功
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

# 进入dist目录
cd dist

# 删除不需要的文件（source maps和src目录）
echo "🧹 清理不必要的文件..."
find . -name "*.map" -delete
rm -rf src/

# 创建zip文件
echo "📦 创建发布包..."
zip -r ../askanything.zip . -x "*.DS_Store"

# 返回上级目录
cd ..

echo "✅ 打包完成！生成文件: askanything.zip"
echo "📊 文件大小: $(du -h askanything.zip | cut -f1)" 