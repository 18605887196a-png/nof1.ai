import { getApiKeyManager, initializeApiKeyManager, createOpenAIClientWithRotation } from './src/utils/apiKeyManager';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// 从.env文件读取所有API密钥
function readApiKeysFromEnv() {
  try {
    // 使用当前工作目录的.env文件
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // 查找OPENAI_API_KEY行
    const apiKeyLine = envContent.split('\n').find(line => line.startsWith('OPENAI_API_KEY='));
    if (!apiKeyLine) {
      throw new Error('未找到OPENAI_API_KEY配置');
    }
    
    // 提取密钥部分（去掉"OPENAI_API_KEY="）
    const keysString = apiKeyLine.substring('OPENAI_API_KEY='.length).trim();
    
    // 按逗号分割密钥
    const apiKeys = keysString.split(',').map(key => key.trim()).filter(key => key.length > 0);
    
    console.log(`📋 从.env文件读取到 ${apiKeys.length} 个API密钥`);
    return apiKeys;
  } catch (error) {
    console.error('❌ 读取.env文件失败:', error.message);
    return [];
  }
}

// 测试单个API密钥是否可用
async function testSingleApiKey(apiKey, index) {
  console.log(`\n🔍 测试第${index + 1}个密钥: ${apiKey.substring(0, 10)}...`);
  
  try {
    // 为单个密钥初始化管理器
    const apiKeyManager = initializeApiKeyManager([apiKey]);
    
    // 获取可用密钥
    const availableKey = await apiKeyManager.getAvailableKey();
    
    // 创建OpenAI客户端
    const openai = new OpenAI({
      apiKey: availableKey,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
    });
    
    // 测试简单的API调用
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10
    });
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ 密钥可用 - 响应时间: ${responseTime}ms`);
    console.log(`   响应内容: "${response.choices[0]?.message?.content || '无内容'}"`);
    
    // 销毁管理器
    apiKeyManager.destroy();
    
    return {
      key: apiKey,
      status: 'available',
      responseTime,
      response: response.choices[0]?.message?.content || '无内容'
    };
  } catch (error) {
    console.log(`❌ 密钥不可用 - 错误: ${error.message}`);
    
    return {
      key: apiKey,
      status: 'unavailable',
      error: error.message
    };
  }
}

// 测试API密钥轮询管理器
async function testApiKeyRotation() {
  console.log('🧪 开始测试API密钥轮询机制...\n');
  
  // 从.env文件读取所有API密钥
  const allApiKeys = readApiKeysFromEnv();
  
  if (allApiKeys.length === 0) {
    console.log('❌ 未找到可用的API密钥，测试终止');
    return;
  }
  
  console.log('\n📊 开始逐个测试密钥可用性...');
  
  const testResults = [];
  let availableCount = 0;
  
  // 逐个测试每个密钥
  for (let i = 0; i < allApiKeys.length; i++) {
    const result = await testSingleApiKey(allApiKeys[i], i);
    testResults.push(result);
    
    if (result.status === 'available') {
      availableCount++;
    }
    
    // 添加延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 ========== 测试结果汇总 ==========');
  console.log(`📋 总密钥数量: ${allApiKeys.length}`);
  console.log(`✅ 可用密钥数量: ${availableCount}`);
  console.log(`❌ 不可用密钥数量: ${allApiKeys.length - availableCount}`);
  
  // 显示可用密钥
  const availableKeys = testResults.filter(r => r.status === 'available');
  if (availableKeys.length > 0) {
    console.log('\n✅ 可用密钥列表:');
    availableKeys.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.key.substring(0, 10)}... (响应时间: ${result.responseTime}ms)`);
    });
  }
  
  // 显示不可用密钥
  const unavailableKeys = testResults.filter(r => r.status === 'unavailable');
  if (unavailableKeys.length > 0) {
    console.log('\n❌ 不可用密钥列表:');
    unavailableKeys.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.key.substring(0, 10)}... (错误: ${result.error})`);
    });
  }
  
  // 测试轮询机制
  if (availableKeys.length > 0) {
    console.log('\n🔧 测试轮询机制...');
    
    const availableKeyList = availableKeys.map(r => r.key);
    const apiKeyManager = initializeApiKeyManager(availableKeyList);
    
    console.log('🔍 测试密钥轮询功能...');
    for (let i = 0; i < Math.min(5, availableKeyList.length); i++) {
      try {
        const currentKey = await apiKeyManager.getAvailableKey();
        console.log(`第${i + 1}次获取密钥: ${currentKey.substring(0, 10)}...`);
      } catch (error) {
        console.log(`第${i + 1}次获取密钥失败:`, error.message);
      }
    }
    
    console.log('\n📊 轮询机制状态统计...');
    const status = apiKeyManager.getStatus();
    console.log('- 总密钥数量:', status.totalKeys);
    console.log('- 健康密钥数量:', status.activeKeys);
    console.log('- 平均响应时间:', status.averageResponseTime.toFixed(2) + 'ms');
  }
  
  console.log('\n✅ API密钥轮询机制测试完成！');
  
  // 生成更新建议
  if (unavailableKeys.length > 0) {
    console.log('\n💡 更新建议:');
    console.log('  建议从.env文件中移除以下不可用密钥:');
    unavailableKeys.forEach(result => {
      console.log(`  - ${result.key}`);
    });
    console.log('\n  保留的可用密钥:');
    availableKeys.forEach(result => {
      console.log(`  - ${result.key}`);
    });
  }
}

// 运行测试
testApiKeyRotation().catch(console.error);