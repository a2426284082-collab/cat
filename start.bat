@echo off
:: 设置控制台编码为 UTF-8 确保中文输出不乱码
chcp 65001 > nul
title React Vite 项目一键启动器

echo ===================================================
echo           React Vite 项目一键启动器
echo ===================================================
echo.

:: 切换到当前批处理文件所在的目录（即 React 项目根目录）
cd /d "%~dp0"

:: 1. 检查是否存在 package.json
if not exist "package.json" (
    echo [错误] 未在当前目录下检测到 package.json 文件！
    echo 请确保将此 .bat 文件放置在 React 项目的根目录下（例如 my_ai_react_app 文件夹内）。
    echo 当前运行路径: %cd%
    echo.
    pause
    exit /b
)

:: 2. 检查系统环境中是否存在 node/npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境！
    echo 请先下载并安装 Node.js：https://nodejs.org/
    echo 并在安装时勾选 "Add to PATH" 选项。
    echo.
    pause
    exit /b
)

echo [1/3] 成功检测到 Node.js 运行环境。

:: 3. 检查 node_modules 目录是否存在，若不存在则自动执行安装
if not exist "node_modules" (
    echo [2/3] 检测到未安装依赖，正在为您执行 npm install ...
    echo 首次安装可能需要数十秒，请耐心等待...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败！请检查您的网络连接。
        echo 提示：如果国内下载慢，可以尝试在控制台手动运行：
        echo npm config set registry https://registry.npmmirror.com
        echo.
        pause
        exit /b
    )
) else (
    echo [2/3] 依赖文件夹 node_modules 已存在，跳过安装。
)

echo [3/3] 正在为您唤起 Vite 开发服务器 ...
echo.

:: 自动在浏览器中打开 Vite 默认的预览地址
start http://localhost:5173

:: 启动本地 React 服务的开发模式
call npm run dev

:: 如果运行中发生非正常退出，保留控制台输出以便排查错误
if %errorlevel% neq 0 (
    echo.
    echo [警报] Vite 服务意外停止，错误代码：%errorlevel%
    pause
)