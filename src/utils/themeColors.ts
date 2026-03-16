// Theme color mappings derived from FTB Quests default theme (ftb_quests_theme.txt)
// ARGB values in the theme file are converted to CSS-friendly formats here.

export const themeColors = {
  // quest_locked_color: #FF999999 (opaque) -> CSS hex
  quest_locked_color: '#999999',

  // quest_completed_color: #C856FF56 -> ARGB: alpha=C8(200/255~0.7843), rgb=56FF56
  quest_completed_color: 'rgba(86,255,86,0.7843)',

  // quest_started_color: #C800FFFF -> ARGB: alpha=C8, rgb=00FFFF
  quest_started_color: 'rgba(0,255,255,0.7843)',

  // quest_not_started_color: #96FFFFFF -> ARGB: alpha=96(150/255~0.5882), rgb=FFFFFF
  quest_not_started_color: 'rgba(255,255,255,0.5882)',
};

export default themeColors;
