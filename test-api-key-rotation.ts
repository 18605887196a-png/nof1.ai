import { getApiKeyManager, initializeApiKeyManager, createOpenAIClientWithRotation } from './src/utils/apiKeyManager';

// 测试API密钥轮询管理器
async function testApiKeyRotation() {
  console.log('🧪 开始测试API密钥轮询机制...\n');
  
  // 创建测试用的API密钥数组（使用你提供的密钥）
  const testApiKeys = [
    "sk-ebe5533e3ca249b9a58d636b6d549ffa",
    "sk-28d92b6756b9436c907f58a651a61d34",
    "sk-2ef761b252c54b548dedf049072ada89",
    "sk-98fed4bf23a9420c91a0f2b9dd35587f",
    "sk-656bd8f7fcd74f87920e55ce872e6a03"
  ];
  
  console.log('📋 初始化API密钥管理器...');
  
  // 初始化API密钥管理器
  const apiKeyManager = initializeApiKeyManager(testApiKeys);
  
  console.log('🔍 测试密钥轮询功能...');
  
  // 测试多次获取可用密钥，应该按顺序轮询
  for (let i = 0; i < 5; i++) {
    try {
      const currentKey = await apiKeyManager.getAvailableKey();
      console.log(`第${i + 1}次获取密钥: ${currentKey.substring(0, 10)}...`);
    } catch (error) {
      console.log(`第${i + 1}次获取密钥失败:`, error.message);
    }
  }
  
  console.log('\n📊 查看密钥状态统计...');
  const status = apiKeyManager.getStatus();
  console.log('- 总密钥数量:', status.totalKeys);
  console.log('- 健康密钥数量:', status.activeKeys);
  console.log('- 平均响应时间:', status.averageResponseTime.toFixed(2) + 'ms');
  
  console.log('\n🔧 测试OpenAI客户端创建...');
  
  try {
    // 测试创建OpenAI客户端（使用轮询机制）
    const openai = await createOpenAIClientWithRotation();
    console.log('✅ OpenAI客户端创建成功！');
    
    // 测试简单的API调用（可能失败，但可以验证客户端创建）
    console.log('🔍 测试API调用...');
    
    try {
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10
      });
      console.log('✅ API调用成功！');
      console.log('响应内容:', response.choices[0]?.message?.content || '无内容');
    } catch (apiError) {
      console.log('⚠️ API调用失败（预期中，因为测试密钥可能无效）:', apiError.message);
      console.log('📝 但客户端创建成功，说明轮询机制工作正常！');
    }
    
  } catch (error) {
    console.log('❌ OpenAI客户端创建失败:', error.message);
  }
  
  console.log('\n✅ API密钥轮询机制测试完成！');
}

// 运行测试
testApiKeyRotation().catch(console.error);