#!/bin/bash

# 验证发布包内容的脚本

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ZIP_FILE="$PROJECT_ROOT/askanything.zip"

if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ 找不到 $ZIP_FILE 文件"
    echo "请先运行 'npm run package' 生成发布包"
    exit 1
fi

echo "🔍 验证发布包内容..."

# 创建临时目录
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# 解压文件
unzip -q "$ZIP_FILE"

echo "📋 检查必要文件..."

# 检查必要文件
REQUIRED_FILES=(
    "manifest.json"
    "service-worker.js"
    "content-script.js"
    "sidepanel.html"
    "sidepanel.js"
    "options.html"
    "options.js"
    "assets/icon16.png"
    "assets/icon48.png"
    "assets/icon128.png"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (缺失)"
        MISSING_FILES+=("$file")
    fi
done

# 检查不应该存在的文件
echo ""
echo "🚫 检查不应该存在的文件..."

UNWANTED_PATTERNS=(
    "*.map"
    "src/"
)

UNWANTED_FOUND=()

for pattern in "${UNWANTED_PATTERNS[@]}"; do
    if find . -name "$pattern" -type f | grep -q .; then
        echo "❌ 发现不应该存在的文件: $pattern"
        find . -name "$pattern" -type f
        UNWANTED_FOUND+=("$pattern")
    else
        echo "✅ 没有发现 $pattern"
    fi
done

# 检查manifest.json版本
echo ""
echo "📄 检查 manifest.json..."
if [ -f "manifest.json" ]; then
    VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    echo "📦 扩展版本: $VERSION"
fi

# 清理临时目录
cd ..
rm -rf "$TEMP_DIR"

# 总结
echo ""
echo "📊 验证结果:"
echo "📦 文件大小: $(du -h "$ZIP_FILE" | cut -f1)"

if [ ${#MISSING_FILES[@]} -eq 0 ] && [ ${#UNWANTED_FOUND[@]} -eq 0 ]; then
    echo "✅ 发布包验证通过！"
    exit 0
else
    echo "❌ 发布包验证失败！"
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        echo "缺失文件: ${MISSING_FILES[*]}"
    fi
    if [ ${#UNWANTED_FOUND[@]} -gt 0 ]; then
        echo "不应该存在的文件: ${UNWANTED_FOUND[*]}"
    fi
    exit 1
fi 