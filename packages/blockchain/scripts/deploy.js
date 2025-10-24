/**
 * ELARA SMART CONTRACTS DEPLOYMENT SCRIPT
 * Deploys ScamReportRegistry, ElaraToken, and ReputationBadges to Polygon
 */

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting Elara smart contracts deployment...\n');

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log('📋 Deployment Configuration:');
  console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${hre.ethers.formatEther(balance)} MATIC\n`);

  if (balance === 0n) {
    console.error('❌ Deployer has no MATIC balance. Please fund the account.');
    process.exit(1);
  }

  // STEP 1: Deploy ElaraToken
  console.log('📝 Deploying ElaraToken...');

  const communityPoolAddress = deployer.address; // Temporarily use deployer
  const teamWalletAddress = deployer.address; // Temporarily use deployer
  const platformReserveAddress = deployer.address; // Temporarily use deployer

  const ElaraToken = await hre.ethers.getContractFactory('ElaraToken');
  const elaraToken = await ElaraToken.deploy(
    communityPoolAddress,
    teamWalletAddress,
    platformReserveAddress
  );

  await elaraToken.waitForDeployment();
  const elaraTokenAddress = await elaraToken.getAddress();

  console.log(`✅ ElaraToken deployed to: ${elaraTokenAddress}`);
  console.log(`   Total Supply: 1,000,000,000 ELARA\n`);

  // STEP 2: Deploy ScamReportRegistry
  console.log('📝 Deploying ScamReportRegistry...');

  const ScamReportRegistry = await hre.ethers.getContractFactory('ScamReportRegistry');
  const scamReportRegistry = await ScamReportRegistry.deploy();

  await scamReportRegistry.waitForDeployment();
  const scamReportRegistryAddress = await scamReportRegistry.getAddress();

  console.log(`✅ ScamReportRegistry deployed to: ${scamReportRegistryAddress}\n`);

  // STEP 3: Deploy ReputationBadges
  console.log('📝 Deploying ReputationBadges...');

  // Base URI for NFT metadata (IPFS or web server)
  const baseURI = process.env.BADGES_BASE_URI || 'https://elara-app.com/api/v2/badges/metadata/';

  const ReputationBadges = await hre.ethers.getContractFactory('ReputationBadges');
  const reputationBadges = await ReputationBadges.deploy(baseURI);

  await reputationBadges.waitForDeployment();
  const reputationBadgesAddress = await reputationBadges.getAddress();

  console.log(`✅ ReputationBadges deployed to: ${reputationBadgesAddress}`);
  console.log(`   Base URI: ${baseURI}\n`);

  // STEP 4: Grant roles
  console.log('🔑 Granting contract roles...');

  // Grant REWARDS_DISTRIBUTOR_ROLE to deployer for ElaraToken
  const REWARDS_DISTRIBUTOR_ROLE = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes('REWARDS_DISTRIBUTOR_ROLE')
  );
  await elaraToken.grantRole(REWARDS_DISTRIBUTOR_ROLE, deployer.address);
  console.log(`✅ Granted REWARDS_DISTRIBUTOR_ROLE to ${deployer.address}`);

  // Grant MINTER_ROLE to deployer for ReputationBadges
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('MINTER_ROLE'));
  await reputationBadges.grantRole(MINTER_ROLE, deployer.address);
  console.log(`✅ Granted MINTER_ROLE to ${deployer.address}\n`);

  // STEP 5: Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ScamReportRegistry: {
        address: scamReportRegistryAddress,
        txHash: scamReportRegistry.deploymentTransaction()?.hash,
      },
      ElaraToken: {
        address: elaraTokenAddress,
        txHash: elaraToken.deploymentTransaction()?.hash,
        communityPool: communityPoolAddress,
        teamWallet: teamWalletAddress,
        platformReserve: platformReserveAddress,
      },
      ReputationBadges: {
        address: reputationBadgesAddress,
        txHash: reputationBadges.deploymentTransaction()?.hash,
        baseURI: baseURI,
      },
    },
  };

  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `${network.name}-${Date.now()}.json`
  );

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log('💾 Deployment info saved to:', deploymentFile);

  // STEP 6: Copy ABIs to backend
  console.log('\n📋 Copying contract ABIs to backend package...');

  const abisDir = path.join(__dirname, '../../backend/blockchain-abis');
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }

  const artifactsDir = path.join(__dirname, '../artifacts/contracts');

  // Copy ScamReportRegistry ABI
  const scamReportRegistryArtifact = require(path.join(
    artifactsDir,
    'ScamReportRegistry.sol/ScamReportRegistry.json'
  ));
  fs.writeFileSync(
    path.join(abisDir, 'ScamReportRegistry.json'),
    JSON.stringify({
      address: scamReportRegistryAddress,
      abi: scamReportRegistryArtifact.abi,
    }, null, 2)
  );

  // Copy ElaraToken ABI
  const elaraTokenArtifact = require(path.join(
    artifactsDir,
    'ElaraToken.sol/ElaraToken.json'
  ));
  fs.writeFileSync(
    path.join(abisDir, 'ElaraToken.json'),
    JSON.stringify({
      address: elaraTokenAddress,
      abi: elaraTokenArtifact.abi,
    }, null, 2)
  );

  // Copy ReputationBadges ABI
  const reputationBadgesArtifact = require(path.join(
    artifactsDir,
    'ReputationBadges.sol/ReputationBadges.json'
  ));
  fs.writeFileSync(
    path.join(abisDir, 'ReputationBadges.json'),
    JSON.stringify({
      address: reputationBadgesAddress,
      abi: reputationBadgesArtifact.abi,
    }, null, 2)
  );

  console.log('✅ ABIs copied successfully\n');

  // STEP 7: Generate environment variables
  console.log('🔐 Environment Variables for .env file:\n');
  console.log('# Blockchain Configuration (Polygon)');
  console.log(`POLYGON_RPC_URL=${network.name === 'polygon' ? 'https://polygon-rpc.com' : 'https://rpc-mumbai.maticvigil.com'}`);
  console.log(`BLOCKCHAIN_PRIVATE_KEY=${process.env.DEPLOYER_PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE'}`);
  console.log(`\n# Smart Contract Addresses`);
  console.log(`SCAM_REPORT_REGISTRY_ADDRESS=${scamReportRegistryAddress}`);
  console.log(`ELARA_TOKEN_ADDRESS=${elaraTokenAddress}`);
  console.log(`REPUTATION_BADGES_ADDRESS=${reputationBadgesAddress}`);

  console.log('\n✨ Deployment complete!\n');
  console.log('📚 Next steps:');
  console.log('   1. Add the environment variables to your .env file');
  console.log('   2. Update frontend with contract addresses');
  console.log('   3. Verify contracts on PolygonScan (if mainnet)');
  console.log('   4. Set up proper wallet addresses for community pool, team, and platform reserve\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
