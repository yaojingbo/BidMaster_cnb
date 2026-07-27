---
name: cog-example-detailed
description: Detailed cognitive model example
---

# 认知模型示例 - 详细写法

## 示例：电商平台

<entities>

<entity id="user" type="actor">
  <name>用户</name>
  <description>在平台上购物的消费者</description>
  <attributes>
    <attribute name="userId" type="string">用户唯一标识</attribute>
    <attribute name="email" type="string">登录邮箱</attribute>
    <attribute name="role" type="enum">用户角色：customer/admin</attribute>
  </attributes>
  <identification>通过userId或email唯一识别</identification>
  <classification>按role分类：普通用户、管理员</classification>
</entity>

<entity id="product" type="resource">
  <name>商品</name>
  <description>平台上销售的商品</description>
  <attributes>
    <attribute name="productId" type="string">商品唯一标识</attribute>
    <attribute name="name" type="string">商品名称</attribute>
    <attribute name="price" type="number">商品价格</attribute>
    <attribute name="stock" type="number">库存数量</attribute>
  </attributes>
  <identification>通过productId唯一识别</identification>
  <classification>按类目分类：电子产品、服装、食品等</classification>
</entity>

<entity id="order" type="transaction">
  <name>订单</name>
  <description>用户的购买记录</description>
  <attributes>
    <attribute name="orderId" type="string">订单唯一标识</attribute>
    <attribute name="userId" type="string">下单用户</attribute>
    <attribute name="totalAmount" type="number">订单总金额</attribute>
    <attribute name="status" type="enum">订单状态</attribute>
  </attributes>
  <identification>通过orderId唯一识别</identification>
  <classification>按status分类：待支付、已支付、已发货、已完成、已取消</classification>
</entity>

</entities>

<relationships>

<relationship id="user-order" type="creates">
  <from>user</from>
  <to>order</to>
  <description>用户创建订单</description>
  <cardinality>1:N</cardinality>
</relationship>

<relationship id="order-product" type="contains">
  <from>order</from>
  <to>product</to>
  <description>订单包含商品</description>
  <cardinality>N:M</cardinality>
</relationship>

</relationships>
