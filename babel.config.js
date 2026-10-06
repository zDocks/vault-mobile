function disableFontScalingPlugin({ types: t }) {
  return {
    name: 'disable-font-scaling-plugin',
    visitor: {
      JSXOpeningElement(path) {
        const name = path.node.name && path.node.name.name;
        if (name === 'Text' || name === 'TextInput') {
          const hasAllowFontScaling = path.node.attributes.some(
            (attr) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'allowFontScaling'
          );
          if (!hasAllowFontScaling) {
            path.node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('allowFontScaling'),
                t.jsxExpressionContainer(t.booleanLiteral(false))
              )
            );
          }
          const hasMaxFontMultiplier = path.node.attributes.some(
            (attr) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'maxFontSizeMultiplier'
          );
          if (!hasMaxFontMultiplier) {
            path.node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('maxFontSizeMultiplier'),
                t.jsxExpressionContainer(t.numericLiteral(1))
              )
            );
          }
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      disableFontScalingPlugin,
      'react-native-reanimated/plugin',
    ],
  };
};

