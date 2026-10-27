import React from 'react';
import LegacyPage from './LegacyPage.jsx';
import html from './basics.html?raw';
import css from './basics.css?raw';
import {mount} from './basics.js';
export default function BasicsPage(){return <LegacyPage html={html} css={css} mount={mount} kind="basics"/>;}
