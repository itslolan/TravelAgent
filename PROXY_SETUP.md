# BrowserBase Proxy Configuration

## ✅ External Proxy Support Added!

Your application now supports both BrowserBase's built-in proxies AND external proxies (like RoundProxies.com).

## 🎯 Using External Proxies (RoundProxies.com)

### **Quick Setup:**

1. **Add to your `.env` file:**
```bash
# External Proxy Configuration (e.g., RoundProxies.com)
PROXY_SERVER=http://your-proxy-server.com:port
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

2. **Restart your server** - That's it! The system will automatically use your external proxy.

### **How It Works:**

The system automatically detects if external proxy credentials are provided:

```javascript
// In sessionManager.js - createEnhancedSession()

// Configure external proxy if credentials are provided
let proxyConfig = enableProxies;

if (enableProxies && process.env.PROXY_SERVER && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
  // Use external proxy (e.g., RoundProxies.com)
  proxyConfig = [
    {
      type: "external",
      server: process.env.PROXY_SERVER,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD
    }
  ];
  console.log('🔒 Using external proxy:', process.env.PROXY_SERVER);
} else if (enableProxies) {
  // Use BrowserBase's built-in proxies
  console.log('🌐 Using BrowserBase built-in proxies');
}
```

### **Example Configuration:**

**For RoundProxies.com:**
```bash
PROXY_SERVER=http://proxy.roundproxies.com:8080
PROXY_USERNAME=your_roundproxies_username
PROXY_PASSWORD=your_roundproxies_password
```

**For Other Proxy Providers:**
```bash
PROXY_SERVER=http://your-proxy-provider.com:port
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

## 🔄 Switching Between Proxy Types

### **Option 1: Use External Proxy (RoundProxies.com)**
Set all three environment variables:
```bash
PROXY_SERVER=http://proxy.roundproxies.com:8080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```
**Console Output:** `🔒 Using external proxy: http://proxy.roundproxies.com:8080`

### **Option 2: Use BrowserBase Built-in Proxies**
Leave the proxy variables empty or remove them:
```bash
# PROXY_SERVER=
# PROXY_USERNAME=
# PROXY_PASSWORD=
```
**Console Output:** `🌐 Using BrowserBase built-in proxies`

### **Option 3: Disable All Proxies**
Set `enableProxies: false` in the code (not recommended for production)

## 📊 What This Does

### **Benefits:**

1. **IP Rotation**: Each session gets a different residential IP address
2. **Geographic Distribution**: IPs from various locations worldwide
3. **Anti-Detection**: Residential IPs are less likely to be blocked by websites
4. **Better Success Rate**: Reduces chance of being flagged as a bot
5. **Managed Service**: BrowserBase handles proxy infrastructure

### **How It Works:**

```
Without Proxies:
Your Server → BrowserBase → Expedia
              (Same IP)

With Proxies:
Your Server → BrowserBase → Residential Proxy → Expedia
              (Different IP each time)
```

## 🌍 Proxy Features

### **1. Built-in Residential Proxies**
- ✅ Automatically managed by BrowserBase
- ✅ No additional configuration needed
- ✅ High-quality residential IPs
- ✅ Global coverage

### **2. Automatic Rotation**
- ✅ New IP for each session
- ✅ Reduces rate limiting
- ✅ Improves reliability

### **3. Transparent Usage**
- ✅ No code changes in your scraping logic
- ✅ Works with existing Playwright code
- ✅ Automatic proxy authentication

## 💰 Pricing & Usage

### **How Proxies Are Measured:**

According to BrowserBase documentation:
- Proxies are measured by **data transfer** (bandwidth)
- Charged separately from session time
- Check your BrowserBase dashboard for usage

### **Who Can Use Proxies:**

- Available on BrowserBase paid plans
- Check your plan details at [browserbase.com](https://www.browserbase.com)

## 🔧 Advanced Configuration (Optional)

If you need more control, you can configure geolocation:

### **Option 1: Specific Country**
```javascript
proxies: [
  {
    type: "browserbase",
    geolocation: {
      country: "US"
    }
  }
]
```

### **Option 2: Specific City**
```javascript
proxies: [
  {
    type: "browserbase",
    geolocation: {
      city: "NEW_YORK",
      state: "NY",
      country: "US"
    }
  }
]
```

### **Option 3: Multiple Proxies with Routing Rules**
```javascript
proxies: [
  {
    type: "browserbase",
    geolocation: { country: "US" },
    routingRules: ["*.expedia.com"]
  },
  {
    type: "browserbase",
    geolocation: { country: "CA" },
    routingRules: ["*.expedia.ca"]
  }
]
```

## 🌎 Available Geolocations

BrowserBase supports proxies from **150+ countries** including:

### **North America:**
- 🇺🇸 United States (US)
- 🇨🇦 Canada (CA)
- 🇲🇽 Mexico (MX)

### **Europe:**
- 🇬🇧 United Kingdom (GB)
- 🇩🇪 Germany (DE)
- 🇫🇷 France (FR)
- 🇮🇹 Italy (IT)
- 🇪🇸 Spain (ES)
- And 40+ more European countries

### **Asia:**
- 🇯🇵 Japan (JP)
- 🇰🇷 South Korea (KR)
- 🇮🇳 India (IN)
- 🇨🇳 China (CN)
- 🇸🇬 Singapore (SG)
- And 40+ more Asian countries

### **Other Regions:**
- South America (Brazil, Argentina, etc.)
- Africa (South Africa, Egypt, etc.)
- Oceania (Australia, New Zealand, etc.)

Full list: https://docs.browserbase.com/features/proxies

## 🧪 Testing

To verify proxies are working:

1. **Check BrowserBase Dashboard:**
   - Go to https://www.browserbase.com/sessions
   - Look at your recent sessions
   - Should show "Proxy: Enabled" or similar

2. **Check IP Address:**
   - Your minions should have different IPs
   - Less likely to hit rate limits

3. **Monitor Success Rate:**
   - Should see improved success rate
   - Fewer timeouts or blocks

## 🎯 Use Cases

### **Your Application:**
- ✅ **Flight Search**: Avoid Expedia rate limiting
- ✅ **Multiple Searches**: Each minion gets different IP
- ✅ **Reliability**: Reduces chance of being blocked
- ✅ **Geographic Testing**: Can test from different locations

### **General Benefits:**
- ✅ **Web Scraping**: Avoid IP bans
- ✅ **Price Comparison**: Get accurate regional pricing
- ✅ **Testing**: Test geo-restricted content
- ✅ **Automation**: More reliable bot detection evasion

## ⚠️ Important Notes

### **1. Billing:**
- Proxies are billed separately from session time
- Monitor your usage in BrowserBase dashboard
- Check your plan's proxy allowance

### **2. Performance:**
- Proxies add slight latency (~100-500ms)
- Still much faster than manual browsing
- Worth it for reliability

### **3. Compliance:**
- Use proxies responsibly
- Respect website terms of service
- Follow rate limiting guidelines

## 🚀 Next Steps

### **Current Setup:**
- ✅ Proxies enabled with `proxies: true`
- ✅ Automatic IP rotation
- ✅ No additional configuration needed

### **Optional Enhancements:**

1. **Add Geolocation** (if needed for specific regions):
   ```javascript
   proxies: [{ type: "browserbase", geolocation: { country: "US" } }]
   ```

2. **Monitor Usage:**
   - Check BrowserBase dashboard regularly
   - Track proxy bandwidth usage
   - Adjust if costs are high

3. **A/B Testing:**
   - Test with/without proxies
   - Compare success rates
   - Optimize based on results

## 📚 Resources

- **BrowserBase Proxy Docs**: https://docs.browserbase.com/features/proxies
- **API Reference**: https://docs.browserbase.com/reference/api/create-a-session
- **Dashboard**: https://www.browserbase.com/sessions
- **Support**: support@browserbase.com

## 🎉 Summary

Proxies are now enabled for all browser sessions! This will:

1. ✅ **Improve reliability** - Less blocking from Expedia
2. ✅ **Rotate IPs** - Each minion gets a different IP
3. ✅ **Reduce rate limits** - Distribute requests across IPs
4. ✅ **Increase success rate** - Better bot detection evasion

Your server will auto-restart and all new sessions will use proxies! 🚀
