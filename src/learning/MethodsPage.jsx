import React from 'react';
import LegacyPage from './LegacyPage.jsx';
import html from './methods.html?raw';
import css from './methods.css?raw';
import {mount} from './methods.js';
export default function MethodsPage(){return <LegacyPage html={html} css={css} mount={mount} kind="methods"/>;}
